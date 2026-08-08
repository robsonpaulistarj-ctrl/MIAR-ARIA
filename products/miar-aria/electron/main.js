const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const aiHandler          = require('./ai-handler');
const storageHandler     = require('./storage-handler');
const fileHandler        = require('./file-handler');
const maintenanceHandler = require('./maintenance-handler');
const memoryHandler      = require('./memory-handler');
const systemHandler      = require('./system-handler');
const cameraHandler      = require('./camera-handler');

// ── Flags Chromium — necessário para Web Speech API + microfone ───────────────
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 680,
    title: 'MIAR ÁRIA - Windows',
    backgroundColor: '#06101c',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'default',
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // ── Permissão de microfone para Web Speech API ────────────────────────────
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allow = ['media', 'microphone', 'audioCapture', 'notifications'];
    callback(allow.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allow = ['media', 'microphone', 'audioCapture'];
    return allow.includes(permission);
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  Menu.setApplicationMenu(null);
}

let agentBackendProcess = null;

function startAgentBackend() {
  if (agentBackendProcess) return;
  const backendPath = path.join(__dirname, '..', '..', '..', 'ai-agent-monitor', 'backend', 'agent_server.py');
  const cwd = path.dirname(backendPath);
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const python = process.env.PYTHON_PATH || process.env.PYTHON || pythonCmd;

  try {
    agentBackendProcess = spawn(python, [backendPath], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    agentBackendProcess.stdout.on('data', (chunk) => {
      console.log(`[agent-backend] ${chunk.toString().trim()}`);
    });
    agentBackendProcess.stderr.on('data', (chunk) => {
      console.error(`[agent-backend] ${chunk.toString().trim()}`);
    });
    agentBackendProcess.on('exit', (code, signal) => {
      console.log(`[agent-backend] exited code=${code} signal=${signal}`);
      agentBackendProcess = null;
    });
  } catch (error) {
    console.error('Erro ao iniciar backend do agent monitor:', error);
    agentBackendProcess = null;
  }
}

function stopAgentBackend() {
  if (!agentBackendProcess) return;
  try {
    agentBackendProcess.kill();
  } catch (error) {
    console.error('Erro ao parar backend do agent monitor:', error);
  }
  agentBackendProcess = null;
}

function createAgentMonitorWindow() {
  const monitorWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    title: 'MIAR ÁRIA — Agent Monitor',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  monitorWindow.loadFile(path.join(__dirname, '..', '..', '..', 'ai-agent-monitor', 'frontend', 'index.html'));
  monitorWindow.on('closed', () => {});
  return monitorWindow;
}

app.whenReady().then(() => {
  storageHandler.init();
  memoryHandler.init();
  startAgentBackend();
  createWindow();

  // ── Auto-updater ─────────────────────────────────────────────────────────
  if (app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('updater:status', { type: 'available', version: info.version });
      });
      autoUpdater.on('download-progress', (p) => {
        mainWindow?.webContents.send('updater:status', { type: 'progress', percent: Math.round(p.percent) });
      });
      autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.webContents.send('updater:status', { type: 'downloaded', version: info.version });
      });
      autoUpdater.on('error', (err) => {
        mainWindow?.webContents.send('updater:status', { type: 'error', message: err.message });
      });

      // Verifica 5 segundos após abrir, depois a cada 2h
      setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
      setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 2 * 60 * 60 * 1000);

      ipcMain.handle('updater:install-now', () => autoUpdater.quitAndInstall());
      ipcMain.handle('updater:check-now', () => autoUpdater.checkForUpdatesAndNotify());
    } catch (e) {
      // electron-updater não disponível em dev
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopAgentBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── CONTEXT MENU — copiar/colar/cortar com mouse ──────────────────────────────
const { Menu: CtxMenu, MenuItem } = require('electron');
app.on('web-contents-created', (_, contents) => {
  contents.on('context-menu', (e, params) => {
    const menu = new CtxMenu();
    if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copiar',      role: 'copy',      accelerator: 'CmdOrCtrl+C' }));
      menu.append(new MenuItem({ label: 'Cortar',      role: 'cut',       accelerator: 'CmdOrCtrl+X' }));
    }
    menu.append(new MenuItem({ label: 'Colar',         role: 'paste',     accelerator: 'CmdOrCtrl+V' }));
    menu.append(new MenuItem({ label: 'Selecionar tudo', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }));
    if (params.selectionText) {
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Copiar mensagem', click: () => {
        contents.executeJavaScript(`navigator.clipboard.writeText(${JSON.stringify(params.selectionText)})`).catch(() => {});
      }}));
    }
    menu.popup({ window: mainWindow });
  });
});

// ── APP VERSION ───────────────────────────────────────────────────────────────
ipcMain.handle('app:get-version', () => app.getVersion());

// ── WHISPER ───────────────────────────────────────────────────────────────────
ipcMain.handle('whisper:transcribe', async (_e, buffer, mimeType) => {
  return await aiHandler.transcribeWithWhisper(Buffer.from(buffer), mimeType);
});

// ── CÂMERA ────────────────────────────────────────────────────────────────────
ipcMain.handle('camera:capture', async () => {
  return cameraHandler.getCameras();
});

// ── STREAMING IA ──────────────────────────────────────────────────────────────
ipcMain.handle('ai:send-stream', async (event, { messages, conversationId, attachments, memories, customInstructions }) => {
  const sysInfo = systemHandler.getSystemInfo();
  try {
    const result = await aiHandler.sendMessageStream(messages, conversationId, attachments, memories, sysInfo, customInstructions, (chunk) => {
      mainWindow?.webContents.send('ai:stream', { type: 'chunk', text: chunk });
    });
    mainWindow?.webContents.send('ai:stream', { type: 'done', ...result });
    return result;
  } catch (err) {
    mainWindow?.webContents.send('ai:stream', { type: 'error', error: err.message });
    return { ok: false, error: err.message };
  }
});

// ── AI ────────────────────────────────────────────────────────────────────────

ipcMain.handle('ai:send-message', async (event, { messages, conversationId, attachments, memories, customInstructions }) => {
  const sysInfo = systemHandler.getSystemInfo();
  return await aiHandler.sendMessage(messages, conversationId, attachments, memories, sysInfo, customInstructions);
});

ipcMain.handle('agent:open-monitor', async () => {
  startAgentBackend();
  createAgentMonitorWindow();
  return { ok: true };
});

// ── SYSTEM / WINDOWS ──────────────────────────────────────────────────────────
ipcMain.handle('system:run-command', async (e, command) => {
  return await systemHandler.runCommand(command);
});
ipcMain.handle('system:get-info', async () => {
  return systemHandler.getSystemInfo();
});

ipcMain.handle('ai:test-key', async (event, { provider, key }) => {
  return await aiHandler.testKey(provider, key);
});

ipcMain.handle('ai:get-key-status', async () => {
  return aiHandler.getKeyStatus();
});

ipcMain.handle('ai:abort', () => {
  aiHandler.abortCurrentRequest();
  return { ok: true };
});

ipcMain.handle('ai:get-usage-stats', () => {
  return aiHandler.getUsageStats();
});

// ── STORAGE ───────────────────────────────────────────────────────────────────

ipcMain.handle('storage:get-settings', async () => storageHandler.getSettings());
ipcMain.handle('storage:save-settings', async (e, s) => storageHandler.saveSettings(s));
ipcMain.handle('storage:get-conversations', async () => storageHandler.getConversations());
ipcMain.handle('storage:get-conversation', async (e, id) => storageHandler.getConversation(id));
ipcMain.handle('storage:create-conversation', async (e, title) => storageHandler.createConversation(title));
ipcMain.handle('storage:save-message', async (e, p) => storageHandler.saveMessage(p.conversationId, p.role, p.content, p.attachments));
ipcMain.handle('storage:update-conversation-title', async (e, p) => storageHandler.updateConversationTitle(p.id, p.title));
ipcMain.handle('storage:update-conversation-color', async (e, p) => storageHandler.updateConversationColor(p.id, p.color));
ipcMain.handle('storage:delete-conversation', async (e, id) => storageHandler.deleteConversation(id));
ipcMain.handle('storage:search-conversations', async (e, q) => storageHandler.searchConversations(q));
ipcMain.handle('storage:get-last-conversation-id', async () => storageHandler.getLastConversationId());
ipcMain.handle('storage:set-last-conversation-id', async (e, id) => storageHandler.setLastConversationId(id));
ipcMain.handle('storage:append-provider-keys', async (e, { provider, keys }) => storageHandler.appendProviderKeys(provider, keys));
ipcMain.handle('storage:delete-provider-keys', async (e, provider) => storageHandler.deleteProviderKeys(provider));
ipcMain.handle('storage:delete-provider-key', async (e, { provider, index }) => storageHandler.deleteProviderKey(provider, index));

// ── MEMORY ────────────────────────────────────────────────────────────────────

ipcMain.handle('memory:add', async (e, p) => memoryHandler.addMemory(p));
ipcMain.handle('memory:get', async (e, p) => memoryHandler.getMemories(p));
ipcMain.handle('memory:search', async (e, query) => memoryHandler.searchRelevantMemories(query));
ipcMain.handle('memory:update', async (e, p) => memoryHandler.updateMemory(p.id, p));
ipcMain.handle('memory:delete', async (e, id) => memoryHandler.deleteMemory(id));
ipcMain.handle('memory:clear-all', async () => memoryHandler.clearAll());
ipcMain.handle('memory:stats', async () => memoryHandler.getStats());
ipcMain.handle('memory:extract', async (e, { snippet }) => {
  const keys = storageHandler.getSettingsRaw().apiKeys || {};
  return await memoryHandler.extractAndSaveMemories(snippet, true, keys);
});

// ── FILES ─────────────────────────────────────────────────────────────────────

ipcMain.handle('file:select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Todos os arquivos', extensions: ['*'] }],
  });
  if (result.canceled) return { canceled: true, files: [] };
  const files = [];
  for (const fp of result.filePaths) files.push(await fileHandler.readFile(fp));
  return { canceled: false, files };
});

ipcMain.handle('file:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecione uma pasta para autorizar acesso',
  });
  if (result.canceled) return { canceled: true };
  const folderPath = result.filePaths[0];
  return { canceled: false, folderPath, ...await fileHandler.listFolder(folderPath) };
});

ipcMain.handle('file:read-folder-file', async (e, fp) => fileHandler.readFile(fp));

// ── MAINTENANCE ───────────────────────────────────────────────────────────────

ipcMain.handle('maintenance:get-app-structure', async () => maintenanceHandler.getAppStructure());
ipcMain.handle('maintenance:create-backup', async () => maintenanceHandler.createBackup());
ipcMain.handle('maintenance:get-logs', async () => maintenanceHandler.getLogs());
