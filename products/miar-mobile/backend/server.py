"""
MIAR ARIA Mobile Backend
Servidor FastAPI que processa requisições de IA para o frontend mobile.
Suporta múltiplos providers (Groq, Gemini, Mistral, OpenRouter) com streaming.
"""

import json
import os
import time
import sqlite3
import asyncio
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx

# ── Config ────────────────────────────────────────────────────────────────────

API_KEYS = {
    "groq": os.getenv("GROQ_API_KEY", "").split(",") if os.getenv("GROQ_API_KEY") else [],
    "gemini": os.getenv("GEMINI_API_KEY", "").split(",") if os.getenv("GEMINI_API_KEY") else [],
    "mistral": os.getenv("MISTRAL_API_KEY", "").split(",") if os.getenv("MISTRAL_API_KEY") else [],
    "openrouter": os.getenv("OPENROUTER_API_KEY", "").split(",") if os.getenv("OPENROUTER_API_KEY") else [],
}

SYSTEM_PROMPT = """Você é a MIAR ARIA, a IA pessoal de Robson Paulo. Ele é médico (psiquiatra) e desenvolvedor.
Seja prestativa, direta e clara. Use português brasileiro.
Você tem acesso a memória de longo prazo sobre ele e seus projetos."""

# ── Models ────────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str  # "user" ou "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    conversation_id: Optional[str] = None
    stream: bool = True
    memories: Optional[str] = None

class KeyConfig(BaseModel):
    provider: str
    keys: List[str]

# ── Database ──────────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "miar_mobile.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'História',
            color TEXT DEFAULT '#27AE60',
            created_at REAL,
            updated_at REAL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT,
            role TEXT,
            content TEXT,
            timestamp REAL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            content TEXT,
            created_at REAL
        )
    """)
    conn.commit()
    conn.close()

def get_db():
    return sqlite3.connect(DB_PATH)

# ── FastAPI App ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="MIAR ARIA Mobile API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir frontend estático
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "..", "frontend", "static")), name="static")

@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html"))

# ── AI Providers ──────────────────────────────────────────────────────────────

async def send_to_groq(messages: List[Dict], stream: bool = True, on_chunk=None):
    """Envia para Groq com streaming SSE."""
    keys = API_KEYS.get("groq", [])
    if not keys:
        return {"ok": False, "error": "Nenhuma chave Groq configurada"}
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "stream": stream,
        "temperature": 0.7,
        "max_tokens": 4096,
    }
    
    for key in keys:
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                if stream:
                    async with client.stream("POST", url, json=payload, headers={"Authorization": f"Bearer {key}"}) as response:
                        if response.status_code != 200:
                            continue
                        full_text = ""
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data)
                                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if delta:
                                        full_text += delta
                                        if on_chunk:
                                            on_chunk(delta)
                                except json.JSONDecodeError:
                                    pass
                        return {"ok": True, "content": full_text}
                else:
                    resp = await client.post(url, json=payload, headers={"Authorization": f"Bearer {key}"})
                    if resp.status_code == 200:
                        data = resp.json()
                        return {"ok": True, "content": data["choices"][0]["message"]["content"]}
        except Exception as e:
            continue
    
    return {"ok": False, "error": "Todas as chaves Groq falharam"}


async def send_to_gemini(messages: List[Dict], stream: bool = True, on_chunk=None):
    """Envia para Gemini com streaming."""
    keys = API_KEYS.get("gemini", [])
    if not keys:
        return {"ok": False, "error": "Nenhuma chave Gemini configurada"}
    
    # Converter formato OpenAI para Gemini
    gemini_messages = []
    system_prompt = SYSTEM_PROMPT
    for msg in messages:
        if msg["role"] == "system":
            system_prompt = msg["content"]
        else:
            role = "user" if msg["role"] == "user" else "model"
            gemini_messages.append({"role": role, "parts": [{"text": msg["content"]}]})
    
    for key in keys:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key={key}"
            payload = {
                "contents": gemini_messages,
                "systemInstruction": {"parts": [{"text": system_prompt}]},
            }
            async with httpx.AsyncClient(timeout=120) as client:
                if stream:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code != 200:
                            continue
                        full_text = ""
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                try:
                                    chunk = json.loads(line[6:])
                                    text = chunk.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                                    if text:
                                        full_text += text
                                        if on_chunk:
                                            on_chunk(text)
                                except (json.JSONDecodeError, IndexError):
                                    pass
                        return {"ok": True, "content": full_text}
                else:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["candidates"][0]["content"]["parts"][0]["text"]
                        return {"ok": True, "content": content}
        except Exception:
            continue
    
    return {"ok": False, "error": "Todas as chaves Gemini falharam"}


# ── API Routes ────────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Envia mensagem para a IA e retorna resposta (com ou sem streaming)."""
    
    # Construir mensagens com system prompt + memória
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    if request.memories:
        messages.append({"role": "system", "content": f"\n\nMemórias relevantes:\n{request.memories}"})
    
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})
    
    # Tentar Groq primeiro, depois Gemini
    if request.stream:
        # Para streaming, usar WebSocket
        result = await send_to_groq(messages, stream=True)
        return result
    else:
        result = await send_to_groq(messages, stream=False)
        if not result.get("ok"):
            result = await send_to_gemini(messages, stream=False)
        return result


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Envia mensagem e retorna resposta em streaming (texto completo)."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if request.memories:
        messages.append({"role": "system", "content": f"\n\nMemórias relevantes:\n{request.memories}"})
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})
    
    result = await send_to_groq(messages, stream=False)
    if not result.get("ok"):
        result = await send_to_gemini(messages, stream=False)
    return result


# ── Conversations (Histórias) ─────────────────────────────────────────────────

@app.get("/api/conversations")
async def get_conversations():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, title, color, created_at, updated_at FROM conversations ORDER BY updated_at DESC")
    rows = c.fetchall()
    conn.close()
    return [
        {"id": r[0], "title": r[1], "color": r[2], "created_at": r[3], "updated_at": r[4]}
        for r in rows
    ]


@app.post("/api/conversations")
async def create_conversation(body: Dict):
    import uuid
    conv_id = body.get("id", str(uuid.uuid4()))
    title = body.get("title", "História")
    color = body.get("color", "#27AE60")
    now = time.time()
    conn = get_db()
    conn.execute("INSERT INTO conversations (id, title, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                 (conv_id, title, color, now, now))
    conn.commit()
    conn.close()
    return {"ok": True, "id": conv_id}


@app.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC", (conv_id,))
    rows = c.fetchall()
    conn.close()
    return [
        {"id": r[0], "role": r[1], "content": r[2], "timestamp": r[3]}
        for r in rows
    ]


@app.put("/api/conversations/{conv_id}")
async def update_conversation(conv_id: str, body: Dict):
    conn = get_db()
    if "title" in body:
        conn.execute("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", (body["title"], time.time(), conv_id))
    if "color" in body:
        conn.execute("UPDATE conversations SET color = ?, updated_at = ? WHERE id = ?", (body["color"], time.time(), conv_id))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    conn = get_db()
    conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Messages ──────────────────────────────────────────────────────────────────

@app.post("/api/conversations/{conv_id}/messages")
async def save_message(conv_id: str, body: Dict):
    role = body.get("role", "user")
    content = body.get("content", "")
    now = time.time()
    conn = get_db()
    conn.execute("INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                 (conv_id, role, content, now))
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Memories ──────────────────────────────────────────────────────────────────

@app.get("/api/memories")
async def get_memories(limit: int = 100):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, category, content, created_at FROM memories ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "category": r[1], "content": r[2], "created_at": r[3]} for r in rows]


@app.post("/api/memories")
async def add_memory(body: Dict):
    category = body.get("category", "geral")
    content = body.get("content", "")
    conn = get_db()
    conn.execute("INSERT INTO memories (category, content, created_at) VALUES (?, ?, ?)",
                 (category, content, time.time()))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/memories")
async def clear_memories():
    conn = get_db()
    conn.execute("DELETE FROM memories")
    conn.commit()
    conn.close()
    return {"ok": True}


# ── API Keys Management ───────────────────────────────────────────────────────

@app.get("/api/keys")
async def get_keys():
    return {"providers": {k: {"count": len(v), "active": len(v) > 0} for k, v in API_KEYS.items()}}


@app.post("/api/keys")
async def set_keys(body: KeyConfig):
    API_KEYS[body.provider] = body.keys
    return {"ok": True, "provider": body.provider, "count": len(body.keys)}


# ── WebSocket para Streaming em Tempo Real ────────────────────────────────────

@app.websocket("/ws")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "chat":
                messages = data.get("messages", [])
                memories = data.get("memories", "")
                
                msg_list = [{"role": "system", "content": SYSTEM_PROMPT}]
                if memories:
                    msg_list.append({"role": "system", "content": f"\n\nMemórias:\n{memories}"})
                for msg in messages:
                    msg_list.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
                
                # Enviar streaming via WebSocket
                def on_chunk(chunk):
                    asyncio.create_task(websocket.send_json({"type": "chunk", "text": chunk}))
                
                result = await send_to_groq(msg_list, stream=True, on_chunk=on_chunk)
                
                if result.get("ok"):
                    await websocket.send_json({"type": "done", "content": result["content"]})
                else:
                    # Fallback para Gemini
                    result2 = await send_to_gemini(msg_list, stream=True, on_chunk=on_chunk)
                    if result2.get("ok"):
                        await websocket.send_json({"type": "done", "content": result2["content"]})
                    else:
                        await websocket.send_json({"type": "error", "error": result2.get("error", "Erro desconhecido")})
                        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "error": str(e)})



from dispatcher import dispatcher



# ── DISPATCHER (Mãe/Filhos) ───────────────────────────────────────────────────

@app.get("/api/apps")
async def get_apps():
    """Lista os apps filhos disponíveis."""
    return dispatcher.get_apps()

@app.post("/api/apps/{app_id}/command")
async def send_command(app_id: str, body: Dict):
    """Envia um comando da MIAR (mãe) para um app filho."""
    command = body.get("command", "")
    context = body.get("context", "")
    result = await dispatcher.send_command(app_id, command, context)
    return result

@app.post("/api/apps/broadcast")
async def broadcast_command(body: Dict):
    """Envia comando para todos os apps filhos."""
    command = body.get("command", "")
    context = body.get("context", "")
    return await dispatcher.broadcast(command, context)

@app.post("/api/apps/{app_id}/toggle")
async def toggle_app(app_id: str, body: Dict):
    """Ativa ou desativa um app filho."""
    enabled = body.get("enabled", True)
    return dispatcher.toggle_app(app_id, enabled)


# ── Start ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--https", action="store_true", help="Usar HTTPS com certificados auto-assinados")
    args = parser.parse_args()
    
    print("🚀 MIAR ARIA Mobile Backend")
    print(f"   Port: 8100")
    
    if args.https:
        cert_file = os.path.join(os.path.dirname(__file__), "server.crt")
        key_file = os.path.join(os.path.dirname(__file__), "server.key")
        
        if not os.path.exists(cert_file) or not os.path.exists(key_file):
            print("⚠️  Certificados não encontrados. Gerando...")
            import https_setup
            https_setup.generate_certs()
        
        if os.path.exists(cert_file) and os.path.exists(key_file):
            print(f"   🔒 HTTPS: https://localhost:8100")
            print(f"   API: https://localhost:8100/api")
            print(f"   ⚠️  No celular, aceite o certificado de segurança.")
            print(f"   Use: https://SEU-IP:8100")
            uvicorn.run(app, host="0.0.0.0", port=8100, 
                       ssl_certfile=cert_file, ssl_keyfile=key_file)
        else:
            print("❌ Não foi possível gerar certificados. Usando HTTP.")
            print(f"   Frontend: http://localhost:8100")
            print(f"   API: http://localhost:8100/api")
            uvicorn.run(app, host="0.0.0.0", port=8100)
    else:
        print(f"   Frontend: http://localhost:8100")
        print(f"   API: http://localhost:8100/api")
        print(f"   💡 Para microfone no celular, use: python3 server.py --https")
        uvicorn.run(app, host="0.0.0.0", port=8100)
