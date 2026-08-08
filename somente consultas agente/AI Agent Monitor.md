# AI Agent Monitor

Protótipo funcional de um agente de IA visual do tipo **"computer use"**, semelhante ao funcionamento do Manus. A IA controla um navegador real, executa tarefas na web e transmite as capturas de ecrã em tempo real para uma janela **Electron**, permitindo acompanhar tudo ao vivo.

## Como Funciona

O sistema segue o padrão de loop visual em cinco passos:

1. O utilizador escreve uma tarefa na janela Electron e clica em **Iniciar**.
2. O backend Python abre um navegador **Chromium real** (via Playwright) e carrega a página inicial.
3. A cada passo, tira um **screenshot** e envia-o ao modelo **GPT-4o** (OpenAI), juntamente com o histórico de ações.
4. O modelo raciocina sobre a imagem e devolve a próxima ação em JSON: `navigate`, `click`, `type`, `scroll`, `press_key`, `extract` ou `done`.
5. A ação é executada no navegador e o ciclo repete. Cada screenshot, pensamento e ação é transmitido ao painel Electron **via WebSocket em tempo real**.

```
┌─────────────────┐    tarefa      ┌──────────────────────────────┐
│   Electron UI   │ ──────────────►│  Backend Python (FastAPI)    │
│                 │                │                              │
│  ┌───────────┐  │   screenshot   │  Loop do Agente:             │
│  │ Monitor   │  │ ◄───────────── │  screenshot ► GPT-4o ► ação  │
│  │ ao vivo   │  │   pensamento   │            │                 │
│  └───────────┘  │   ações        │       Playwright (Chromium)  │
│                 │                └──────────────────────────────┘
│  Logs + Controlo│ ── WebSocket ──►  ws://localhost:8000/ws/agent
└─────────────────┘
```

## Estrutura do Projeto

```
ai-agent-monitor/
├── backend/
│   ├── agent_server.py      # Servidor FastAPI + loop do agente + WebSocket
│   ├── test_agent.py        # Teste automatizado do pipeline (sem OpenAI)
│   ├── requirements.txt     # Dependências Python
│   └── .env.example         # Modelo de variáveis de ambiente
├── frontend/
│   ├── package.json         # Dependências Electron
│   ├── index.html           # Painel de monitorização
│   ├── assets/              # Ícones (opcional)
│   └── src/
│       ├── main.js          # Processo principal Electron
│       ├── preload.js       # Ponte segura IPC
│       ├── renderer.js      # Lógica do painel (WebSocket + UI)
│       └── style.css        # Tema escuro do painel
├── ARCHITECTURE.md          # Documento de arquitetura detalhado
└── README.md                # Este ficheiro
```

## Como Executar

### 1. Backend (Python)

```bash
cd backend

# instalar dependências
pip install -r requirements.txt
playwright install chromium

# configurar a chave da OpenAI
cp .env.example .env
# edite .env e coloque a sua chave: OPENAI_API_KEY=sk-...

# iniciar o servidor
python agent_server.py
# → Servidor na porta 8000 | WebSocket: ws://localhost:8000/ws/agent
```

### 2. Frontend (Electron)

```bash
cd frontend

npm install
npm start
```

A janela abre automaticamente e liga-se ao servidor Python. Escreva uma tarefa e clique em **Iniciar** — verá o navegador a abrir no seu ecrã e o painel a atualizar em tempo real com screenshots, raciocínio e ações.

## Configuração (variáveis de ambiente)

| Variável | Valor padrão | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | — | Chave da API OpenAI (obrigatória) |
| `OPENAI_MODEL` | `gpt-4o` | Modelo a usar (ex.: `gpt-4o-mini` para mais barato) |
| `WINDOW_WIDTH` / `WINDOW_HEIGHT` | `1280` / `800` | Resolução da janela do navegador agente |
| `MAX_STEPS` | `40` | Máximo de ações por tarefa |
| `PORT` | `8000` | Porta do servidor |

## Protocolo WebSocket

O cliente liga-se a `ws://localhost:8000/ws/agent`.

**Mensagens do cliente → servidor:**

```json
{"type": "task",  "text": "Pesquisa o preço atual do Bitcoin"}
{"type": "stop"}
```

**Mensagens do servidor → cliente:**

| Tipo | Conteúdo |
|---|---|
| `screenshot` | Imagem JPEG em base64 da página atual |
| `screenshot_info` | Texto de estado (ex.: "Passo 3/40 — click") |
| `thought` | Raciocínio da IA |
| `action` | Ação executada (JSON) |
| `result` | Resultado final da tarefa |
| `status` | `idle` / `running` / `error` |

## Como Personalizar / Expandir

- **Mais ações**: adicione handlers em `execute_action()` no `agent_server.py` (ex.: `select_option`, `hover`, `screenshot_region`) e descreva-os no `SYSTEM_PROMPT`.
- **Outro modelo**: altere `OPENAI_MODEL` para `gpt-4o-mini`, ou aponte para um servidor compatível (Anthropic, Gemini, vLLM) modificando o cliente OpenAI.
- **Histórico longo**: o prompt atual envia screenshots acumulados; para tarefas longas, implemente resumo/compressão do histórico a cada N passos.
- **Múltiplas tarefas**: o servidor atende uma ligação de cada vez; para concorrência, lance um `asyncio.Task` por cliente com browsers independentes.
- **Pacote Electron**: `npm install electron-builder --save-dev` e configure o `build` no `package.json` para distribuir a aplicação.

## Testes

O ficheiro `test_agent.py` testa o pipeline completo (screenshot → modelo mock → ação → resultado) sem precisar de chave OpenAI:

```bash
cd backend
pip install websockets
python test_agent.py
```

## Notas Técnicas

- O navegador abre em modo **visível** (`headless=False`) para que o utilizador veja a IA a trabalhar; altere para `headless=True` se preferir invisível.
- Cada screenshot é comprimido como JPEG (qualidade 75) antes de ser enviado, para manter a transmissão rápida.
- O agente tem recuperação de erros: se uma ação falha, informa o modelo e pede uma alternativa.
- Apenas **uma ligação de WebSocket** é aceita de cada vez (um browser por servidor).
