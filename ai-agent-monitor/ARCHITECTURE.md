# Arquitetura do Protótipo — AI Agent Monitor

## Visão Geral

O protótipo replica o padrão "computer use" do Manus: um agente de IA controla um navegador real, executa tarefas na web e transmite as capturas de ecrã em tempo real para uma janela de monitorização (Electron).

## Fluxo de Dados

```
Utilizador (Electron) ──tarefa──► Python (FastAPI + WebSocket)
        ▲                               │
        │                    ┌──────────▼──────────┐
        │                    │  Loop do Agente:     │
        │                    │  1. Screenshot       │
        │                    │  2. LLM analisa      │
        │        screenshot  │  3. Decide ação      │
        │◄───────────────────│  4. Executa (Playwright)
        │        log         │     (clicar, digitar, navegar, rolar)
        └────────────────────│  5. Repete até concluir
                             └─────────────────────┘
```

## Componentes

### 1. Backend (Python — `backend/agent_server.py`)

- **FastAPI**: API HTTP para submeter tarefas (`POST /task`) e ver o estado.
- **WebSocket (`/ws/agent`)**: transmite em tempo real cada screenshot (JPEG, ~800px), o pensamento da IA e o log de ações.
- **Playwright (Chromium, headless=false)**: navegador real controlado pelo agente.
- **Agente LLM**: GPT-4o (ou GPT-4o-mini via variável de ambiente) recebe o screenshot + histórico e decide a próxima ação.
- **Ações suportadas**: `navigate`, `click`, `type`, `scroll`, `press_key`, `extract`, `done`.

### 2. Frontend (Electron — `frontend/`)

- **index.html + renderer.js**: painel com o "monitor" (imagem ao vivo), caixa de input de tarefa, log de ações e raciocínio da IA.
- **preload.js**: expõe APIs seguras de IPC entre main e renderer.
- **main.js**: cria a janela Electron e liga o WebSocket diretamente ao servidor Python (sem IPC para WebSocket — o renderer liga direto ao `ws://localhost:8000/ws/agent`).

### 3. Comunicação

- O renderer liga-se diretamente ao WebSocket do Python — simplifica a arquitetura (o Electron serve apenas como shell do painel).
- Mensagens WS do servidor:
  - `{"type":"screenshot","data":"base64...", "ts":...}` — imagem ao vivo.
  - `{"type":"thought","text":"...","ts":...}` — raciocínio da IA.
  - `{"type":"action","text":"...","ts":...}` — ação executada.
  - `{"type":"status","text":"idle|running|done|error","ts":...}`.
  - `{"type":"result","text":"...","ts":...}` — conclusão.
- Mensagens do cliente:
  - `{"type":"task","text":"pesquisa preço do bitcoin"}`.
  - `{"type":"stop"}`.

## Como Executar

```bash
cd backend
pip install fastapi uvicorn[standard] playwright openai pillow
playwright install chromium
export OPENAI_API_KEY="sk-..."
python agent_server.py
# depois, na pasta frontend:
npm install && npm start
```

## Configuração

- `OPENAI_API_KEY` (obrigatória): chave OpenAI.
- `OPENAI_MODEL` (opcional): default `gpt-4o`.
- Porta do servidor: 8000 (configurável com `--port`).
- `WINDOW_WIDTH`/`WINDOW_HEIGHT`: resolução da captura para o monitor.
