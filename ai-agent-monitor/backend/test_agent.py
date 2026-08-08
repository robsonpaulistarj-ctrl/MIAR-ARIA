"""Teste do pipeline do agente (Playwright + screenshot + WebSocket) sem chamar a OpenAI."""
import asyncio
import base64
import json

import uvicorn
from fastapi import FastAPI, WebSocket

from agent_server import run_agent, execute_action  # importa o loop do agente

app = FastAPI()


# Mock do cliente OpenAI para testar o fluxo sem chave API
class MockChoice:
    def __init__(self, content):
        self.message = type("M", (), {"content": content})()


MOCK_RESPONSES = [
    # passo 1: navegar para um site
    json.dumps({
        "reasoning": "Vou abrir um site simples para testar.",
        "action": {"type": "navigate", "url": "https://example.com"},
    }),
    # passo 2: terminar com resultado
    json.dumps({
        "reasoning": "Página carregada com sucesso.",
        "action": {"type": "done", "result": "Teste concluído: a página example.com carregou corretamente."},
    }),
]


class MockCompletions:
    def __init__(self):
        self.i = 0

    def create(self, **kwargs):
        resp = MOCK_RESPONSES[self.i % len(MOCK_RESPONSES)]
        self.i += 1
        return type("R", (), {"choices": [MockChoice(resp)]})()


class MockChat:
    completions = MockCompletions()


import agent_server
agent_server.client.chat = MockChat()


@app.websocket("/ws/agent")
async def agent_ws(ws: WebSocket):
    await ws.accept()
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                await run_agent(browser, ws, "Teste automático")
            finally:
                await browser.close()
    except Exception as e:
        await ws.send_json({"type": "result", "text": f"Erro: {e}", "ts": 0})


async def main():
    config = uvicorn.Config(app, host="127.0.0.1", port=8001, log_level="warning")
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve())
    while not server.started:
        await asyncio.sleep(0.05)

    # ligar um cliente de teste
    import websockets  # pip install websockets
    async with websockets.connect("ws://127.0.0.1:8001/ws/agent") as ws:
        # simular o agente a pedir tarefa via HTTP-like WS (usamos mensagem task)
        await ws.send(json.dumps({"type": "task", "text": "Teste automático"}))
        seen = {"screenshot": 0, "thought": 0, "action": 0, "result": 0}
        while True:
            msg = json.loads(await ws.recv())
            t = msg["type"]
            if t in seen:
                seen[t] += 1
            print(f"← {t}: {str(msg.get('text', ''))[:80]}")
            if t == "result":
                break
        assert seen["screenshot"] >= 2, "deveria receber screenshots"
        assert seen["result"] == 1, "deveria terminar com done"
        # verificar que a base64 é válida
        await ws.send(json.dumps({"type": "task", "text": "x"}))
        msg = json.loads(await ws.recv())
        if msg["type"] == "screenshot":
            base64.b64decode(msg["data"])
            print("✓ base64 do screenshot válida")
        print("\n✅ TODOS OS TESTES PASSARAM")
        await ws.send(json.dumps({"type": "stop"}))

    server.should_exit = True
    await task


if __name__ == "__main__":
    asyncio.run(main())
