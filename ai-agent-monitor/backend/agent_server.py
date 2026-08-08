"""
AI Agent Monitor — Backend (Python + FastAPI + Playwright + OpenAI)

Servidor que implementa um agente visual do tipo "computer use":
  1. Recebe uma tarefa via WebSocket
  2. Abre um navegador Chromium real com Playwright
  3. Tira um screenshot e envia-o ao modelo GPT-4o
  4. O modelo devolve a próxima ação (JSON)
  5. A ação é executada no navegador e o ciclo repete
  6. Cada screenshot, pensamento e ação é transmitido ao
     cliente (Electron) em tempo real via WebSocket

Dependências:
  pip install fastapi "uvicorn[standard]" playwright openai pillow
  playwright install chromium

Variáveis de ambiente:
  OPENAI_API_KEY  (obrigatória)
  OPENAI_MODEL    (opcional, default gpt-4o)
"""

import asyncio
import base64
import io
import json
import os
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
WINDOW_WIDTH = int(os.environ.get("WINDOW_WIDTH", "1280"))
WINDOW_HEIGHT = int(os.environ.get("WINDOW_HEIGHT", "800"))
MAX_STEPS = int(os.environ.get("MAX_STEPS", "40"))
PORT = int(os.environ.get("PORT", "8000"))

client = OpenAI(api_key=OPENAI_API_KEY)

# ---------------------------------------------------------------------------
# Prompt do sistema — define o comportamento e o esquema de ações do agente
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = f"""
Você é um agente de IA visual que controla um navegador web.
Você recebe capturas de ecrã (screenshots) da página atual e deve
raciocinar e escolher UMA ação por vez para completar a tarefa do utilizador.

O browser window tem {WINDOW_WIDTH}x{WINDOW_HEIGHT} pixels.
Coordenadas x entre 0 e {WINDOW_WIDTH}, y entre 0 e {WINDOW_HEIGHT}.

Escreva sempre o seu raciocínio primeiro, e depois responda COM EXACTAMENTE
um objeto JSON (nada mais) neste formato:

{{"reasoning": "breve explicação do que vê e do que vai fazer",
 "action": {{"type": "...", ...args...}}}}

Ações disponíveis:

1. {{\"type\": \"navigate\", \"url\": \"https://exemplo.com\"}}
   — Abre um URL.

2. {{\"type\": \"click\", \"x\": 500, \"y\": 300}}
   — Clica no elemento mais próximo dessas coordenadas.
   Baseie-se no que vê no screenshot (texto de botões, links).

3. {{\"type\": \"type\", \"x\": 500, \"y\": 300, \"text\": \"query\"}}
   — Digita texto num campo de pesquisa/entrada perto dessas coordenadas.

4. {{\"type\": \"scroll\", \"direction\": \"down\"}}
   — Rola a página para baixo (ou \"up\").

5. {{\"type\": \"press_key\", \"key\": \"Enter\"}}
   — Pressiona uma tecla (Enter, Escape, Tab, etc.).

6. {{\"type\": \"extract\", \"description\": \"o que procurar na página\"}}
   — Extrai texto da página para responder à pergunta.

7. {{\"type\": \"done\", \"result\": \"resposta final para o utilizador\"}}
   — Termina a tarefa com o resultado.

Regras:
- Só responda quando a tarefa estiver completa, ou se estiver preso
  por 3 passos consecutivos, use \"done\" com o melhor resultado possível.
- Não repita a mesma ação nas mesmas coordenadas sem mudança.
- Para pesquisar no Google, escreva no campo de pesquisa e pressione Enter.
- O JSON DEVE ser válido e estar no final da sua resposta.
"""

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="AI Agent Monitor", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# O agente só pode atender UM cliente de cada vez (um browser por servidor).
_connected: WebSocket | None = None


# ---------------------------------------------------------------------------
# Extração do JSON do modelo (resiliente a texto extra)
# ---------------------------------------------------------------------------
def extract_json(text: str) -> dict | None:
    # tenta encontrar o primeiro { ... } válido
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    start = None
    return None


# ---------------------------------------------------------------------------
# Loop do agente
# ---------------------------------------------------------------------------
async def run_agent(browser, ws: WebSocket, task: str):
    ctx = await browser.new_context(viewport={"width": WINDOW_WIDTH, "height": WINDOW_HEIGHT})
    page = await ctx.new_page()
    await page.set_viewport_size({"width": WINDOW_WIDTH, "height": WINDOW_HEIGHT})
    await page.goto("https://www.google.com")

    history = [{"role": "system", "content": SYSTEM_PROMPT}]
    await ws.send_json({"type": "thought", "text": f"Tarefa recebida: {task}", "ts": asyncio.get_event_loop().time()})

    for step in range(1, MAX_STEPS + 1):
        # 1) Screenshot
        raw = await page.screenshot()
        img = Image.open(io.BytesIO(raw))
        if img.width > WINDOW_WIDTH:
            img = img.resize((WINDOW_WIDTH, WINDOW_HEIGHT), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75)
        b64 = base64.b64encode(buf.getvalue()).decode()
        await ws.send_json({"type": "screenshot", "data": b64, "ts": step})

        # 2) Perguntar ao modelo
        user_content = [
            {"type": "text", "text": f"STEP {step}/{MAX_STEPS}. Tarefa: {task}"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]
        history.append({"role": "user", "content": user_content})

        await ws.send_json({"type": "thought", "text": "A pensar…", "ts": step})
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=history,
            max_tokens=1500,
        )
        raw_text = resp.choices[0].message.content or ""
        parsed = extract_json(raw_text)

        if parsed is None:
            await ws.send_json({
                "type": "thought",
                "text": f"Resposta do modelo não contém JSON válido:\n{raw_text[:500]}",
                "ts": step,
            })
            history.append({"role": "assistant", "content": raw_text})
            history.append({"role": "user", "content": [{"type": "text", "text": "Responda com o JSON da ação."}]})
            continue

        reasoning = parsed.get("reasoning", "")
        action = parsed.get("action", {})
        atype = action.get("type", "")
        if reasoning:
            await ws.send_json({"type": "thought", "text": reasoning, "ts": step})
        await ws.send_json({"type": "action", "text": json.dumps(action, ensure_ascii=False), "ts": step})
        await ws.send_json({"type": "screenshot_info", "text": f"Passo {step}/{MAX_STEPS} — {atype}", "ts": step})

        # 3) Executar a ação
        try:
            done = await execute_action(page, action)
        except Exception as e:
            # ação falhou — informar o modelo
            history.append({"role": "assistant", "content": json.dumps(parsed, ensure_ascii=False)})
            history.append({"role": "user", "content": [{"type": "text", "text": f"Erro ao executar a ação: {e}. Tente outra coisa."}]})
            await ws.send_json({"type": "thought", "text": f"Erro: {e}. A tentar outra abordagem.", "ts": step})
            continue

        history.append({"role": "assistant", "content": json.dumps(parsed, ensure_ascii=False)})

        if done is not None:
            await ws.send_json({"type": "result", "text": done, "ts": step})
            return

        await ws.send_json({"type": "screenshot_info", "text": "Página atualizada. A analisar…", "ts": step})
        # pequeno delay para a página estabilizar
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except Exception:
            pass
        await asyncio.sleep(1.0)

    await ws.send_json({"type": "result", "text": "Número máximo de passos atingido sem conclusão.", "ts": MAX_STEPS})


async def execute_action(page, action: dict) -> str | None:
    atype = action.get("type")
    if atype == "navigate":
        await page.goto(action["url"], wait_until="domcontentloaded")
    elif atype == "click":
        await page.mouse.click(int(action["x"]), int(action["y"]))
    elif atype == "type":
        await page.mouse.click(int(action["x"]), int(action["y"]))
        await asyncio.sleep(0.3)
        await page.keyboard.type(action["text"], delay=30)
    elif atype == "scroll":
        delta = -400 if action.get("direction", "down") == "down" else 400
        await page.mouse.wheel(0, delta)
    elif atype == "press_key":
        await page.keyboard.press(action["key"])
    elif atype == "extract":
        # extrai o texto visível da página e devolve como "resultado" parcial
        # (o modelo pode usá-lo no passo seguinte via screenshot + texto)
        text = await page.evaluate("document.body.innerText")
        # guardamos o texto num atributo da página para referência
        page._extracted_text = text[:4000]
    elif atype == "done":
        return action.get("result", "Tarefa concluída.")
    else:
        raise ValueError(f"Ação desconhecida: {atype}")
    return None


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
@app.websocket("/ws/agent")
async def agent_ws(ws: WebSocket):
    global _connected
    await ws.accept()
    if _connected is not None:
        await ws.send_json({"type": "status", "text": "error", "ts": 0})
        await ws.send_json({"type": "result", "text": "Já existe um cliente ligado. Só uma ligação de cada vez.", "ts": 0})
        await ws.close()
        return
    _connected = ws
    try:
        while True:
            msg = await ws.receive_json()
            mtype = msg.get("type")
            if mtype == "task" and msg.get("text"):
                await ws.send_json({"type": "status", "text": "running", "ts": 0})
                try:
                    from playwright.async_api import async_playwright
                    async with async_playwright() as p:
                        browser = await p.chromium.launch(headless=False)
                        try:
                            await run_agent(browser, ws, msg["text"])
                        finally:
                            await browser.close()
                except Exception as e:
                    await ws.send_json({"type": "result", "text": f"Erro do agente: {e}", "ts": 0})
                await ws.send_json({"type": "status", "text": "idle", "ts": 0})
            elif mtype == "stop":
                await ws.send_json({"type": "result", "text": "Tarefa interrompida pelo utilizador.", "ts": 0})
                await ws.send_json({"type": "status", "text": "idle", "ts": 0})
                break
    except WebSocketDisconnect:
        pass
    finally:
        _connected = None


@app.get("/")
async def root():
    return {
        "service": "AI Agent Monitor",
        "status": "ok",
        "model": OPENAI_MODEL,
        "ws": "ws://localhost:8000/ws/agent",
    }


if __name__ == "__main__":
    import uvicorn
    print(f"🤖 AI Agent Monitor a correr na porta {PORT}")
    print(f"   Modelo: {OPENAI_MODEL} | Janela: {WINDOW_WIDTH}x{WINDOW_HEIGHT}")
    print(f"   WebSocket: ws://localhost:{PORT}/ws/agent")
    if not OPENAI_API_KEY:
        print("⚠️  AVISO: OPENAI_API_KEY não definida!")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
