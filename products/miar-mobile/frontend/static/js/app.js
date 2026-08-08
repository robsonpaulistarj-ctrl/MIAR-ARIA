/**
 * MIAR ARIA Mobile — App JavaScript
 * Interface mobile-first com streaming, câmera, histórias, TTS e coordenação de apps.
 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  currentConversation: null,
  conversations: [],
  memories: [],
  isStreaming: false,
  streamBuffer: '',
  selectedColor: '#27AE60',
  ws: null,
  ttsPaused: false,
  ttsSpeaking: false,
  micActive: false,
  micTimeout: null,
  micTimeoutDuration: 3000, // 3 segundos de silêncio para disparar
};

// ── DOM Elements ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  welcomeScreen: $('welcome-screen'),
  app: $('app'),
  storyName: $('story-name'),
  storyDesc: $('story-desc'),
  btnCreateStory: $('btn-create-story'),
  headerTitle: $('header-title'),
  headerDot: $('header-dot'),
  btnSidebar: $('btn-sidebar'),
  btnNewStory: $('btn-new-story'),
  btnCloseSidebar: $('btn-close-sidebar'),
  sidebar: $('sidebar'),
  sidebarOverlay: $('sidebar-overlay'),
  storiesList: $('stories-list'),
  chatArea: $('chat-area'),
  messagesContainer: $('messages-container'),
  streamingIndicator: $('streaming-indicator'),
  msgInput: $('msg-input'),
  btnSend: $('btn-send'),
  btnMic: $('btn-mic'),
  btnCamera: $('btn-camera'),
  btnAttach: $('btn-attach'),
  btnMemory: $('btn-memory'),
  btnTts: $('btn-tts'),
  timestamp: $('timestamp'),
  charCount: $('char-count'),
  cameraModal: $('camera-modal'),
  cameraPreview: $('camera-preview'),
  cameraCanvas: $('camera-canvas'),
  btnCapture: $('btn-capture'),
  btnCloseCamera: $('btn-close-camera'),
  settingsPanel: $('settings-panel'),
  btnCloseSettings: $('btn-close-settings'),
  btnClearMemories: $('btn-clear-memories'),
  memoryCount: $('memory-count'),
  colorDots: document.querySelectorAll('.color-dot'),
  actionButtons: $('action-buttons'),
};

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadConversations();
  setupEventListeners();
  updateTimestamp();
  setInterval(updateTimestamp, 1000);
  connectWebSocket();
});

// ── Event Listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
  // Criar história
  el.btnCreateStory.addEventListener('click', createFirstStory);
  el.storyName.addEventListener('keydown', (e) => { if (e.key === 'Enter') createFirstStory(); });

  // Seleção de cor
  el.colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      el.colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      state.selectedColor = dot.dataset.color;
    });
  });

  // Sidebar
  el.btnSidebar.addEventListener('click', toggleSidebar);
  el.btnCloseSidebar.addEventListener('click', toggleSidebar);
  el.sidebarOverlay.addEventListener('click', toggleSidebar);

  // Nova história
  el.btnNewStory.addEventListener('click', showNewStoryPrompt);

  // Enviar mensagem
  el.btnSend.addEventListener('click', sendMessage);
  el.msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  el.msgInput.addEventListener('input', () => {
    el.msgInput.style.height = 'auto';
    el.msgInput.style.height = Math.min(el.msgInput.scrollHeight, 150) + 'px';
    el.charCount.textContent = el.msgInput.value.length > 0 ? `${el.msgInput.value.length} chars` : '';
  });

  // Microfone
  el.btnMic.addEventListener('click', toggleMicrophone);

  // Câmera
  el.btnCamera.addEventListener('click', openCamera);
  el.btnCapture.addEventListener('click', capturePhoto);
  el.btnCloseCamera.addEventListener('click', closeCamera);

  // Memória
  el.btnMemory.addEventListener('click', toggleMemoryMode);

  // TTS
  el.btnTts.addEventListener('click', toggleTTS);

  // Configurações (duplo clique no header)
  el.headerTitle.addEventListener('dblclick', toggleSettings);
  el.btnCloseSettings.addEventListener('click', toggleSettings);

  // Limpar memórias
  el.btnClearMemories.addEventListener('click', clearMemories);

  // Drag & Drop dos botões de ação
  setupDraggableButtons();
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/ws`;
  
  state.ws = new WebSocket(wsUrl);
  
  state.ws.onopen = () => {
    console.log('WebSocket conectado');
  };
  
  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWsMessage(data);
  };
  
  state.ws.onclose = () => {
    console.log('WebSocket desconectado, reconectando em 3s...');
    setTimeout(connectWebSocket, 3000);
  };
  
  state.ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

function handleWsMessage(data) {
  if (data.type === 'chunk') {
    state.streamBuffer += data.text;
    updateStreamingMessage();
  } else if (data.type === 'done') {
    finishStreaming(data.content || state.streamBuffer);
  } else if (data.type === 'error') {
    finishStreaming(null, data.error);
  }
}

function updateStreamingMessage() {
  let msgEl = el.messagesContainer.querySelector('.message.assistant.streaming');
  if (!msgEl) {
    msgEl = createMessageElement('assistant', '', true);
    el.streamingIndicator.style.display = 'none';
  }
  msgEl.querySelector('.msg-content').textContent = state.streamBuffer;
  scrollToBottom();
}

function finishStreaming(content, error) {
  state.isStreaming = false;
  state.streamBuffer = '';
  el.streamingIndicator.style.display = 'none';
  el.btnSend.disabled = false;
  el.btnTts.classList.remove('hidden');
  
  let msgEl = el.messagesContainer.querySelector('.message.assistant.streaming');
  if (msgEl) {
    msgEl.classList.remove('streaming');
    if (content) {
      msgEl.querySelector('.msg-content').textContent = content;
    } else if (error) {
      msgEl.querySelector('.msg-content').textContent = `Erro: ${error}`;
    }
    updateMessageTime(msgEl);
  }
  
  // Salvar no backend
  if (content && state.currentConversation) {
    saveMessageToServer('assistant', content);
  }
}

// ── Conversas (Histórias) ─────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const resp = await fetch('/api/conversations');
    state.conversations = await resp.json();
    renderStoriesList();
    
    if (state.conversations.length > 0) {
      el.welcomeScreen.style.display = 'none';
      el.app.style.display = 'flex';
      selectConversation(state.conversations[0].id);
    }
  } catch (e) {
    console.error('Erro ao carregar conversas:', e);
  }
}

async function createFirstStory() {
  const title = el.storyName.value.trim() || `História ${state.conversations.length + 1}`;
  const desc = el.storyDesc.value.trim();
  
  const resp = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, color: state.selectedColor })
  });
  const data = await resp.json();
  
  if (data.ok) {
    // Salvar descrição como primeira mensagem do sistema
    if (desc) {
      await fetch(`/api/conversations/${data.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: `[Contexto da história]: ${desc}` })
      });
    }
    await loadConversations();
    selectConversation(data.id);
  }
}

function renderStoriesList() {
  el.storiesList.innerHTML = state.conversations.map(conv => `
    <div class="story-item ${conv.id === state.currentConversation ? 'active' : ''}" 
         data-id="${conv.id}" onclick="selectConversation('${conv.id}')">
      <span class="dot" style="background:${conv.color}"></span>
      <span class="name">${conv.title}</span>
      <span class="time">${formatTime(conv.updated_at)}</span>
    </div>
  `).join('');
}

async function selectConversation(id) {
  state.currentConversation = id;
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;
  
  el.headerTitle.textContent = conv.title;
  el.headerDot.style.background = conv.color;
  
  // Fechar sidebar
  el.sidebar.classList.remove('active');
  el.sidebarOverlay.classList.remove('active');
  
  // Carregar mensagens
  try {
    const resp = await fetch(`/api/conversations/${id}`);
    const messages = await resp.json();
    el.messagesContainer.innerHTML = '';
    messages.forEach(msg => {
      if (msg.role !== 'system') {
        const msgEl = createMessageElement(msg.role, msg.content, false);
        updateMessageTime(msgEl, msg.timestamp);
      }
    });
    scrollToBottom();
    renderStoriesList();
  } catch (e) {
    console.error('Erro ao carregar mensagens:', e);
  }
}

function toggleSidebar() {
  el.sidebar.classList.toggle('active');
  el.sidebarOverlay.classList.toggle('active');
}

function showNewStoryPrompt() {
  el.storyName.value = '';
  el.storyDesc.value = '';
  el.welcomeScreen.style.display = 'flex';
  el.app.style.display = 'none';
  el.storyName.focus();
}

// ── Enviar Mensagem ───────────────────────────────────────────────────────────
async function sendMessage() {
  const text = el.msgInput.value.trim();
  if (!text || state.isStreaming || !state.currentConversation) return;
  
  state.isStreaming = true;
  state.streamBuffer = '';
  
  // Mostrar mensagem do usuário
  const userMsg = createMessageElement('user', text, false);
  el.msgInput.value = '';
  el.msgInput.style.height = 'auto';
  el.charCount.textContent = '';
  el.btnSend.disabled = true;
  
  // Salvar no servidor
  await saveMessageToServer('user', text);
  
  // Obter memórias
  let memories = '';
  if (state.memories.length > 0) {
    memories = state.memories.map(m => `${m.category}: ${m.content}`).join('\n');
  }
  
  // Preparar histórico
  const history = getConversationHistory();
  
  // Enviar via WebSocket
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    el.streamingIndicator.style.display = 'flex';
    scrollToBottom();
    state.ws.send(JSON.stringify({
      type: 'chat',
      messages: history,
      memories: memories
    }));
  } else {
    // Fallback para HTTP
    try {
      const resp = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          conversation_id: state.currentConversation,
          memories: memories
        })
      });
      const data = await resp.json();
      if (data.ok) {
        const assistantMsg = createMessageElement('assistant', data.content, false);
        updateMessageTime(assistantMsg);
        await saveMessageToServer('assistant', data.content);
        el.btnTts.classList.remove('hidden');
      }
    } catch (e) {
      createMessageElement('assistant', 'Erro ao conectar. Verifique o servidor.', false);
    }
    el.btnSend.disabled = false;
    state.isStreaming = false;
  }
}

function getConversationHistory() {
  const msgs = el.messagesContainer.querySelectorAll('.message');
  const history = [];
  msgs.forEach(m => {
    const role = m.classList.contains('user') ? 'user' : 'assistant';
    const content = m.querySelector('.msg-content').textContent;
    history.push({ role, content });
  });
  return history;
}

async function saveMessageToServer(role, content) {
  if (!state.currentConversation) return;
  try {
    await fetch(`/api/conversations/${state.currentConversation}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content })
    });
  } catch (e) {
    console.error('Erro ao salvar mensagem:', e);
  }
}

// ── Mensagens UI ──────────────────────────────────────────────────────────────
function createMessageElement(role, content, streaming = false) {
  const div = document.createElement('div');
  div.className = `message ${role}${streaming ? ' streaming' : ''}`;
  div.innerHTML = `
    <span class="msg-content">${content}</span>
    <span class="msg-time"></span>
  `;
  el.messagesContainer.appendChild(div);
  scrollToBottom();
  return div;
}

function updateMessageTime(msgEl, timestamp) {
  const now = timestamp ? new Date(timestamp * 1000) : new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-BR');
  msgEl.querySelector('.msg-time').textContent = timeStr;
  msgEl.querySelector('.msg-time').title = dateStr;
}

function scrollToBottom() {
  el.chatArea.scrollTop = el.chatArea.scrollHeight;
}

function updateTimestamp() {
  const now = new Date();
  el.timestamp.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.timestamp.title = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Câmera ────────────────────────────────────────────────────────────────────
let cameraStream = null;

async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    el.cameraPreview.srcObject = cameraStream;
    el.cameraModal.style.display = 'flex';
  } catch (e) {
    alert('Não foi possível acessar a câmera. Verifique as permissões.');
  }
}

function capturePhoto() {
  if (!cameraStream) return;
  
  const canvas = el.cameraCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = el.cameraPreview.videoWidth;
  canvas.height = el.cameraPreview.videoHeight;
  ctx.drawImage(el.cameraPreview, 0, 0);
  
  // Converter para base64 e adicionar como mensagem
  const imageData = canvas.toDataURL('image/jpeg', 0.8);
  
  closeCamera();
  
  // Adicionar como anexo na próxima mensagem
  el.msgInput.value = `[Imagem capturada]\n${imageData}`;
  el.msgInput.style.height = 'auto';
  el.msgInput.style.height = Math.min(el.msgInput.scrollHeight, 150) + 'px';
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  el.cameraModal.style.display = 'none';
}

// ── Microfone (Speech Recognition) ────────────────────────────────────────────
let recognitionInstance = null;
let micFinalTranscript = '';
let micRestartCount = 0;
const MAX_RESTARTS = 5;

function toggleMicrophone() {
  if (state.micActive) {
    stopMicrophone();
    return;
  }
  
  // Verificar suporte
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    // Fallback: usar API de áudio do navegador (Web Speech API pode não estar disponível)
    // Em mobile (Android Chrome), a Web Speech API funciona bem
    alert('Reconhecimento de voz não disponível neste navegador.\nTente: Chrome no Android ou Safari no iOS.');
    return;
  }
  
  startRecognition();
}

function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognitionInstance = new SpeechRecognition();
  
  recognitionInstance.lang = 'pt-BR';
  recognitionInstance.continuous = true;
  recognitionInstance.interimResults = true;
  recognitionInstance.maxAlternatives = 1;
  
  let silenceTimer = null;
  
  recognitionInstance.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        micFinalTranscript += transcript;
        resetSilenceTimer();
      } else {
        interim += transcript;
      }
    }
    el.msgInput.value = micFinalTranscript + interim;
    el.msgInput.dispatchEvent(new Event('input'));
    el.msgInput.focus();
  };
  
  function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      stopMicrophone();
      if (el.msgInput.value.trim()) {
        sendMessage();
      }
    }, state.micTimeoutDuration);
  }
  
  recognitionInstance.onend = () => {
    // Auto-restart se ainda estiver ativo (evita que pare sozinho)
    if (state.micActive && micRestartCount < MAX_RESTARTS) {
      micRestartCount++;
      console.log(`Microfone: auto-restart (${micRestartCount})`);
      setTimeout(() => {
        if (state.micActive) startRecognition();
      }, 100);
    } else {
      state.micActive = false;
      micRestartCount = 0;
      el.btnMic.style.background = '';
      el.btnMic.style.animation = '';
      clearTimeout(silenceTimer);
    }
  };
  
  recognitionInstance.onerror = (e) => {
    console.error('Speech error:', e.error);
    
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      alert('Permissão de microfone negada.\nVá nas configurações do navegador e permita o microfone para este site.');
      stopMicrophone();
    } else if (e.error === 'no-speech') {
      // Sem problema - só não ouviu nada
      console.log('Nenhuma fala detectada, continuando...');
    } else if (e.error === 'network') {
      console.error('Erro de rede na Speech API. Verifique a conexão.');
    } else if (e.error === 'aborted') {
      // Normal quando paramos manualmente
    } else {
      console.error(`Speech error: ${e.error}`);
    }
  };
  
  recognitionInstance.onstart = () => {
    state.micActive = true;
    el.btnMic.style.background = '#e74c3c';
    el.btnMic.style.animation = 'pulse 1.5s infinite';
    console.log('Microfone iniciado');
  };
  
  try {
    recognitionInstance.start();
  } catch (e) {
    // Se já está rodando, não fazer nada
    if (e.message.includes('already started')) {
      // OK
    } else {
      console.error('Erro ao iniciar reconhecimento:', e);
      stopMicrophone();
    }
  }
}

function stopMicrophone() {
  state.micActive = false;
  micRestartCount = 0;
  el.btnMic.style.background = '';
  el.btnMic.style.animation = '';
  if (recognitionInstance) {
    try { recognitionInstance.stop(); } catch(e) {}
    recognitionInstance = null;
  }
}

// Adicionar animação pulse no CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
document.head.appendChild(style);

// ── TTS ───────────────────────────────────────────────────────────────────────
function toggleTTS() {
  if (state.ttsSpeaking && !state.ttsPaused) {
    // Pausar
    speechSynthesis.pause();
    state.ttsPaused = true;
    el.btnTts.textContent = '▶️';
  } else if (state.ttsPaused) {
    // Retomar
    speechSynthesis.resume();
    state.ttsPaused = false;
    el.btnTts.textContent = '⏸️';
  } else {
    // Parar tudo e falar
    speechSynthesis.cancel();
    const lastMsg = el.messagesContainer.querySelector('.message.assistant:last-child .msg-content');
    if (lastMsg) {
      speak(lastMsg.textContent);
    }
  }
}

function speak(text) {
  if (!text || text.length === 0) return;
  
  // Cortar para utterances de até 2000 chars
  const chunks = [];
  while (text.length > 0) {
    let chunk = text.substring(0, 2000);
    // Tentar cortar no último ponto
    const lastPeriod = chunk.lastIndexOf('.');
    if (lastPeriod > 1500) {
      chunk = text.substring(0, lastPeriod + 1);
    }
    chunks.push(chunk);
    text = text.substring(chunk.length);
  }
  
  // Filtrar apenas vozes femininas
  const voices = speechSynthesis.getVoices();
  const femaleVoices = voices.filter(v => 
    /female|mulher|woman|samantha|vicki|karen|moira|tessa|zira|heera|hazel/i.test(v.name)
  );
  const voice = femaleVoices.length > 0 ? femaleVoices[0] : voices.find(v => v.lang.startsWith('pt'));
  
  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    if (voice) utterance.voice = voice;
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    
    if (i === 0) {
      utterance.onstart = () => {
        state.ttsSpeaking = true;
        state.ttsPaused = false;
        el.btnTts.textContent = '⏸️';
      };
      utterance.onend = () => {
        state.ttsSpeaking = false;
        state.ttsPaused = false;
        el.btnTts.textContent = '🔊';
      };
    }
    speechSynthesis.speak(utterance);
  });
}

// ── Memória ───────────────────────────────────────────────────────────────────
async function toggleMemoryMode() {
  try {
    const resp = await fetch('/api/memories');
    state.memories = await resp.json();
    
    if (state.memories.length > 0) {
      const memoryText = state.memories.map(m => `[${m.category}] ${m.content}`).join('\n');
      el.msgInput.value = `[Memórias carregadas — ${state.memories.length} itens]\n${memoryText}\n\n`;
      el.msgInput.dispatchEvent(new Event('input'));
    } else {
      alert('Nenhuma memória salva.');
    }
    
    // Atualizar contador
    el.memoryCount.textContent = `${state.memories.length} memórias`;
  } catch (e) {
    console.error('Erro ao carregar memórias:', e);
  }
}

async function clearMemories() {
  if (confirm('Tem certeza que quer apagar TODAS as memórias?')) {
    await fetch('/api/memories', { method: 'DELETE' });
    state.memories = [];
    el.memoryCount.textContent = '0 memórias';
    alert('Memórias apagadas.');
  }
}

// ── Configurações / Apps ──────────────────────────────────────────────────────
function toggleSettings() {
  el.settingsPanel.classList.toggle('active');
  if (el.settingsPanel.classList.contains('active')) {
    loadMemoryCount();
    loadApps();
  }
}

async function loadMemoryCount() {
  try {
    const resp = await fetch('/api/memories');
    const memories = await resp.json();
    el.memoryCount.textContent = `${memories.length} memórias`;
  } catch (e) {
    el.memoryCount.textContent = '0 memórias';
  }
}

// ── Drag & Drop dos botões ────────────────────────────────────────────────────
function setupDraggableButtons() {
  const buttons = el.actionButtons.querySelectorAll('.btn-action');
  let draggedBtn = null;

  buttons.forEach(btn => {
    btn.addEventListener('dragstart', (e) => {
      draggedBtn = btn;
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    btn.addEventListener('dragend', () => {
      btn.classList.remove('dragging');
      buttons.forEach(b => b.style.border = '');
    });

    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedBtn && draggedBtn !== btn) {
        const allBtns = [...el.actionButtons.children];
        const draggedIndex = allBtns.indexOf(draggedBtn);
        const targetIndex = allBtns.indexOf(btn);
        
        if (draggedIndex < targetIndex) {
          btn.after(draggedBtn);
        } else {
          btn.before(draggedBtn);
        }
      }
    });

    // Touch support para mobile
    btn.addEventListener('touchstart', handleTouchStart, { passive: false });
    btn.addEventListener('touchmove', handleTouchMove, { passive: false });
    btn.addEventListener('touchend', handleTouchEnd);
  });
}

let touchDragBtn = null;
let touchStartX = 0;

function handleTouchStart(e) {
  touchDragBtn = e.currentTarget;
  touchStartX = e.touches[0].clientX;
  touchDragBtn.classList.add('dragging');
}

function handleTouchMove(e) {
  if (!touchDragBtn) return;
  e.preventDefault();
  // Visual feedback apenas
}

function handleTouchEnd(e) {
  if (!touchDragBtn) return;
  touchDragBtn.classList.remove('dragging');
  touchDragBtn = null;
}


// ── Apps (Mãe/Filhos) ─────────────────────────────────────────────────────────
async function loadApps() {
  try {
    const resp = await fetch('/api/apps');
    const apps = await resp.json();
    
    const appsList = document.querySelector('.apps-list');
    if (appsList) {
      appsList.innerHTML = apps.map(app => `
        <div class="app-item" data-app="${app.id}" onclick="openApp('${app.id}')">
          <span class="app-icon">${app.icon}</span>
          <div class="app-info">
            <span class="app-name">${app.name}</span>
            <span class="app-status">${app.description} — ${app.status}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Erro ao carregar apps:', e);
  }
}

async function openApp(appId) {
  // Enviar comando para o app filho via MIAR (mãe)
  const command = `Abra o ${appId} e mostre o estado atual`;
  
  try {
    const resp = await fetch(`/api/apps/${appId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, context: 'Aberto pela MIAR principal' })
    });
    const data = await resp.json();
    
    if (data.ok) {
      // Mostrar resposta no chat
      const responseText = JSON.stringify(data.response, null, 2);
      createMessageElement('assistant', `📱 **${appId}** respondeu:\n${responseText.substring(0, 500)}`, false);
    } else {
      createMessageElement('assistant', `⚠️ ${appId}: ${data.error || 'Não disponível no momento'}`, false);
    }
  } catch (e) {
    createMessageElement('assistant', `⚠️ Erro ao comunicar com ${appId}: ${e.message}`, false);
  }
  
  // Fechar settings
  el.settingsPanel.classList.remove('active');
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Carregar vozes
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
