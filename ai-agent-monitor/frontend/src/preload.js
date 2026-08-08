const { contextBridge } = require("electron");

// APIs expostas de forma segura ao renderer (IPC).
// Nota: o WebSocket liga-se diretamente ao servidor Python
// (ws://localhost:8000/ws/agent) a partir do renderer, sem passar pelo IPC.
contextBridge.exposeInMainWorld("electronAPI", {
  setTitle: (title) => {
    // placeholder — pode expandir conforme necessário
    return title;
  },
});
