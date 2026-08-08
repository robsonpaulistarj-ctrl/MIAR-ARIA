// AI Agent Monitor — Renderer (Electron)
// Liga-se diretamente ao WebSocket do servidor Python e atualiza o painel.

const WS_URL = "ws://localhost:8000/ws/agent";

const el = {
  monitor: document.getElementById("monitor"),
  monitorEmpty: document.getElementById("monitor-empty"),
  stepInfo: document.getElementById("step-info"),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  taskInput: document.getElementById("task-input"),
  btnStart: document.getElementById("btn-start"),
  btnStop: document.getElementById("btn-stop"),
  thoughtLog: document.getElementById("thought-log"),
  actionLog: document.getElementById("action-log"),
  resultBox: document.getElementById("result-box"),
};

let ws = null;
let reconnectTimer = null;

// ---------------- Ligação WebSocket ----------------
function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setStatus("idle", "Pronto — escreva uma tarefa e clique em Iniciar");
    clearTimeout(reconnectTimer);
  };

  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    handleMessage(msg);
  };

  ws.onclose = () => {
    setStatus("error", "Desligado — a tentar religar em 3s…");
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => ws.close();
}

function setStatus(state, text) {
  el.status.className = "status " + state;
  el.statusText.textContent = text;
}

// ---------------- Processamento de mensagens ----------------
function handleMessage(msg) {
  switch (msg.type) {
    case "screenshot":
      el.monitor.src = "data:image/jpeg;base64," + msg.data;
      el.monitorEmpty.style.display = "none";
      break;

    case "screenshot_info":
      el.stepInfo.textContent = msg.text;
      break;

    case "thought":
      addEntry(el.thoughtLog, msg.text);
      break;

    case "action":
      addEntry(el.actionLog, msg.text);
      break;

    case "result":
      addEntry(el.resultBox, msg.text);
      break;

    case "status":
      if (msg.text === "running") {
        setStatus("running", "Agente a trabalhar…");
        el.btnStart.disabled = true;
        el.btnStop.disabled = false;
        el.taskInput.disabled = true;
      } else {
        setStatus("idle", "Pronto — escreva uma tarefa e clique em Iniciar");
        el.btnStart.disabled = false;
        el.btnStop.disabled = true;
        el.taskInput.disabled = false;
      }
      break;
  }
}

function addEntry(container, text) {
  const entry = document.createElement("div");
  entry.className = "entry";
  const ts = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="ts">${ts}</span>${escapeHtml(text)}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------- Controlos ----------------
el.btnStart.addEventListener("click", () => {
  const text = el.taskInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  // limpar logs para a nova tarefa
  el.thoughtLog.innerHTML = "";
  el.actionLog.innerHTML = "";
  el.resultBox.innerHTML = "";
  el.stepInfo.textContent = "";
  ws.send(JSON.stringify({ type: "task", text }));
});

el.btnStop.addEventListener("click", () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "stop" }));
  }
});

// Iniciar
connect();
