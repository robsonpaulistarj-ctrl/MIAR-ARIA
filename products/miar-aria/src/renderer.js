// MIAR ÁRIA — Renderer (frontend)
'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────────
const state = {
  currentConvId: null,
  messages: [],
  attachments: [],
  folderFiles: [],
  folderPath: null,
  selectedFolderFiles: [],
  ttsEnabled: true,
  ttsVoice: null,
  ttsRate: 1.0,
  ttsPitch: 1.1,
  memoryEnabled: true,
  isSending: false,
  isListening: false,
  recognition: null,
  speechRecognition: null,
  voiceInputActive: false,
  voices: [],
  _streamingActive: false,
};

// ── TEMA DIA / NOITE / SISTEMA ────────────────────────────────────────────────
const THEMES = ['dark', 'light', 'system'];
const THEME_LABELS = { dark: '🌙 Noite', light: '☀️ Dia', system: '🖥️ Sistema' };

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = THEME_LABELS[theme] || '🌙 Noite';
}

function initTheme() {
  const saved = localStorage.getItem('miar-theme') || 'dark';
  applyTheme(saved);
  // Reage a mudança do sistema quando no modo "system"
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('miar-theme') || 'dark') === 'system') applyTheme('system');
  });
}

window.cycleTheme = function () {
  const current = localStorage.getItem('miar-theme') || 'dark';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  localStorage.setItem('miar-theme', next);
  applyTheme(next);
};


window.openAgentMonitor = async function () {
  if (!window.miar?.openAgentMonitor) {
    alert('Monitor de agente não disponível no momento.');
    return;
  }
  try {
    const result = await window.miar.openAgentMonitor();
    if (!result?.ok) {
      alert('Não foi possível abrir o monitor do agente. Verifique a instalação do backend.');
    }
  } catch (error) {
    console.error('Falha ao abrir monitor do agente:', error);
    alert('Erro ao abrir o monitor do agente. Veja o console para mais detalhes.');
  }
};

// ── CLOCK HH:MM:SS ────────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const time = `${hh}:${mm}:${ss}`;
    const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const el = document.getElementById('clock');
    if (el) { el.textContent = time; el.title = date; }
    const top = document.getElementById('topbar-clock');
    if (top) { top.textContent = time; top.title = date; }
  }
  tick();
  setInterval(tick, 1000);
}

function updateActivityStatus(message, kind = 'idle') {
  const el = document.getElementById('activity-status');
  if (!el) return;
  el.textContent = message;
  el.className = 'activity-status' + (kind ? ` ${kind}` : '');
}

// ── API COUNTER ───────────────────────────────────────────────────────────────
const SESSION_LIMIT = 100;

async function refreshApiCounter() {
  if (!window.miar?.getUsageStats) return;
  try {
    const stats = await window.miar.getUsageStats();
    const used = stats.total || 0;
    const remaining = Math.max(0, SESSION_LIMIT - used);
    const pct = Math.max(0, Math.round((remaining / SESSION_LIMIT) * 100));
    const tip = `${remaining} chamadas restantes de ${SESSION_LIMIT}\n─────────────────\nGroq: ${stats.groq.chamadas} (${stats.groq.percentual})\nGemini: ${stats.gemini.chamadas} (${stats.gemini.percentual})\nMistral: ${stats.mistral?.chamadas ?? 0} (${stats.mistral?.percentual ?? '0%'})\nOpenRouter: ${stats.openrouter.chamadas} (${stats.openrouter.percentual})\nErros: ${stats.erros.chamadas}`;

    // Cor muda conforme o % vai caindo
    const color = pct > 50 ? 'var(--accent)' : pct > 20 ? '#e6b800' : 'var(--error, #e74c3c)';

    const rem = document.getElementById('api-remaining');
    if (rem) { rem.textContent = `${pct}%`; rem.title = tip; rem.style.color = color; }

    const el = document.getElementById('api-counter');
    if (el) { el.textContent = `API: ${used}`; el.title = tip; }
  } catch {}
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  startClock();
  loadVoices();
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
  await loadSettings();
  await loadConversationList();
  const lastId = await window.miar.getLastConversationId();
  if (lastId) await openConversation(lastId);
  updateAiStatus();
  refreshApiCounter();
  setupMic();
  setupEventListeners();
  // Mostra versão no canto superior direito
  if (window.miar?.getAppVersion) {
    window.miar.getAppVersion().then(v => {
      const el = document.getElementById('app-version');
      if (el) el.textContent = `v${v}`;
    });
  }
});

// ── VOICES / TTS ──────────────────────────────────────────────────────────────
function loadVoices() {
  if (!window.speechSynthesis) return;
  state.voices = window.speechSynthesis.getVoices();
  const sel = document.getElementById('voice-select');
  if (!sel) return;
  const saved = sel.value;
  sel.innerHTML = '';
  // Filtrar apenas vozes femininas (nomes que sugerem feminino)
  const femaleNames = /francisca|maria|vitoria|vitória|fernanda|ana|lucia|bianca|juliana|carolina|helena|isabela|sophia|camila|letícia|leticia|amanda|rafaela|thais|tais|beatriz|paula|laura|mariana|daniela|patricia|adriana|cristina|sabrina|michelle|nicole|andrea|clara|alice|elisa|serena|victoria|samantha|monica|karen|susan|google|zira|sarah|jenny|aria|emma/i;
  const ptVoices = state.voices.filter(v => v.lang.startsWith('pt') && femaleNames.test(v.name));
  const ptAll = state.voices.filter(v => v.lang.startsWith('pt'));
  const allFemale = state.voices.filter(v => femaleNames.test(v.name));
  const displayVoices = ptVoices.length > 0 ? ptVoices : (ptAll.length > 0 ? ptAll : (allFemale.length > 0 ? allFemale : state.voices));
  for (const v of displayVoices) {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    sel.appendChild(opt);
  }
  const target = saved || state.ttsVoice;
  if (target) sel.value = target;
  else {
    const best = ptVoices.find(v => /francisca|maria|vitoria|vitória|fernanda|ana|lucia|bianca/i.test(v.name)) || ptVoices[0];
    if (best) { sel.value = best.name; state.ttsVoice = best.name; }
  }
}

let _currentUtterance = null;
let _ttsPaused = false;

function speak(text) {
  if (!state.ttsEnabled || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  _ttsPaused = false;
  const clean = text.replace(/```[\s\S]*?```/g, 'código omitido').replace(/[*_#`~]/g, '');
  const utter = new SpeechSynthesisUtterance(clean.substring(0, 2000));
  utter.lang = 'pt-BR';
  utter.rate = state.ttsRate;
  utter.pitch = state.ttsPitch;
  const voiceName = document.getElementById('voice-select')?.value || state.ttsVoice;
  if (voiceName) {
    const v = state.voices.find(x => x.name === voiceName);
    if (v) utter.voice = v;
  }
  _currentUtterance = utter;
  updateTtsPauseBtn();
  utter.onend = () => { _currentUtterance = null; _ttsPaused = false; updateTtsPauseBtn(); };
  utter.onerror = () => { _currentUtterance = null; _ttsPaused = false; updateTtsPauseBtn(); };
  speechSynthesis.speak(utter);
}

function updateTtsPauseBtn() {
  const btn = document.getElementById('stop-tts-btn');
  if (!btn) return;
  if (_currentUtterance) {
    btn.style.display = 'inline-flex';
    if (_ttsPaused) {
      btn.textContent = '▶️ Continuar';
      btn.title = 'Continuar fala';
    } else {
      btn.textContent = '⏸ Pausar';
      btn.title = 'Pausar fala (clique de novo para parar)';
    }
  } else {
    btn.style.display = 'none';
  }
}

window.togglePauseSpeech = function () {
  if (!_currentUtterance) return;
  if (_ttsPaused) {
    speechSynthesis.resume();
    _ttsPaused = false;
  } else {
    speechSynthesis.pause();
    _ttsPaused = true;
  }
  updateTtsPauseBtn();
};

window.stopSpeech = function () {
  speechSynthesis.cancel();
  _currentUtterance = null;
  _ttsPaused = false;
  updateTtsPauseBtn();
};

// Esc para parar a fala
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && speechSynthesis.speaking) window.stopSpeech();
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await window.miar.getSettings();
  state.ttsEnabled = s.ttsEnabled ?? true;
  state.ttsVoice = s.ttsVoice || '';
  state.ttsRate = s.ttsRate || 1.0;
  state.ttsPitch = s.ttsPitch || 1.1;
  state.memoryEnabled = s.memoryEnabled ?? true;
  state.customInstructions = s.customInstructions || '';
  const ciEl = document.getElementById('custom-instructions');
  if (ciEl) ciEl.value = state.customInstructions;
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.value = s.userEmail || '';
  updateTtsBtn();

  const rateEl = document.getElementById('tts-rate');
  const pitchEl = document.getElementById('tts-pitch');
  if (rateEl) { rateEl.value = state.ttsRate; document.getElementById('tts-rate-val').textContent = state.ttsRate; }
  if (pitchEl) { pitchEl.value = state.ttsPitch; document.getElementById('tts-pitch-val').textContent = state.ttsPitch; }

  for (const provider of ['groq', 'gemini', 'openrouter', 'mistral', 'mem0']) {
    const badge    = document.getElementById(`${provider}-badge`);
    const clearBtn = document.getElementById(`${provider}-clear`);
    const list     = document.getElementById(`${provider}-keys-list`);
    const count    = s.apiKeysCounts?.[provider] || 0;
    const masked   = s.apiKeysMasked?.[provider] || [];

    if (badge) {
      badge.textContent = count > 0 ? `${count} chave${count > 1 ? 's' : ''}` : 'Nenhuma';
      badge.className   = `key-badge ${count > 0 ? 'set' : 'unset'}`;
    }
    if (clearBtn) clearBtn.classList.toggle('hidden', count === 0);

    // Renderiza lista de chaves salvas (mascaradas) com botão deletar individual
    if (list) {
      list.innerHTML = masked.map((m, i) => `
        <div class="saved-key-item">
          <span class="saved-key-icon">🔑</span>
          <span class="saved-key-value">${escHtml(m)}</span>
          <button class="saved-key-del" onclick="deleteOneKey('${provider}',${i})" title="Remover esta chave">✕</button>
        </div>`).join('');
    }
  }
}

window.deleteOneKey = async function (provider, index) {
  await window.miar.deleteProviderKey({ provider, index });
  await loadSettings();
  updateAiStatus();
};

window.clearProviderKeys = async function (provider) {
  if (!confirm(`Apagar todas as chaves de ${provider}?`)) return;
  await window.miar.deleteProviderKeys(provider);
  await loadSettings();
  updateAiStatus();
  showKeyResult(provider, true, 'Chaves apagadas.');
};

window.saveAllSettings = async function () {
  const voiceSel = document.getElementById('voice-select');
  const rate = parseFloat(document.getElementById('tts-rate')?.value || '1.0');
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || '1.1');
  state.ttsVoice = voiceSel?.value || '';
  state.ttsRate = rate;
  state.ttsPitch = pitch;
  const ciEl = document.getElementById('custom-instructions');
  state.customInstructions = ciEl?.value || '';
  const userEmail = document.getElementById('user-email')?.value || '';
  await window.miar.saveSettings({ ttsEnabled: state.ttsEnabled, ttsVoice: state.ttsVoice, ttsRate: rate, ttsPitch: pitch, memoryEnabled: state.memoryEnabled, customInstructions: state.customInstructions, userEmail });
  closeModal('settings-modal');
  updateAiStatus();
};

// ── KEY MANAGEMENT ────────────────────────────────────────────────────────────

/** Lê o textarea, parseia chaves (vírgula ou newline), ADICIONA às existentes */
window.saveKeyTextarea = async function (provider) {
  const ta = document.getElementById(`${provider}-textarea`);
  const raw = ta?.value || '';
  const newKeys = raw.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
  if (!newKeys.length) { showKeyResult(provider, false, 'Cole pelo menos uma chave.'); return; }
  const res = await window.miar.appendProviderKeys({ provider, keys: newKeys });
  if (ta) ta.value = '';
  await loadSettings();
  showKeyResult(provider, true, `✓ ${newKeys.length} adicionada(s). Total: ${res.total}`);
  updateAiStatus();
};

/** Testa a primeira chave colada no textarea */
window.testKeyFromTextarea = async function (provider) {
  const ta = document.getElementById(`${provider}-textarea`);
  const raw = ta?.value || '';
  const keys = raw.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
  if (!keys.length) { showKeyResult(provider, false, 'Cole uma chave para testar.'); return; }
  showKeyResult(provider, null, 'Testando…');
  const res = await window.miar.testKey({ provider, key: keys[0] });
  if (res.ok) showKeyResult(provider, true, `✓ OK — modelo: ${res.model} — "${(res.text||'').substring(0,50)}"`);
  else showKeyResult(provider, false, `✗ ${res.error}`);
};

/** Salva chave do Mem0 */
window.saveMem0Key = async function () {
  const inp = document.getElementById('mem0-key-input');
  const key = inp?.value.trim();
  if (!key) { showKeyResult('mem0', false, 'Chave vazia.'); return; }
  await window.miar.saveSettings({ apiKeys: { mem0: key } });
  if (inp) inp.value = '';
  await loadSettings();
  showKeyResult('mem0', true, '✓ Chave Mem0 salva. Memória em nuvem ativa.');
};

function showKeyResult(provider, ok, msg) {
  const el = document.getElementById(`${provider}-result`);
  if (!el) return;
  el.className = 'key-result ' + (ok === true ? 'ok' : ok === false ? 'error' : '');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── CONVERSATION LIST ─────────────────────────────────────────────────────────
function getConvPeriod(updatedAt) {
  const now = new Date();
  const d = new Date(updatedAt);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays <= 7) return 'Esta semana';
  if (diffDays <= 30) return 'Este mês';
  const monthYear = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
}

function buildConvItem(conv) {
  const item = document.createElement('div');
  item.className = 'conv-item' + (conv.id === state.currentConvId ? ' active' : '');
  const date = new Date(conv.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const storyColor = conv.color || 'var(--accent)';
  item.innerHTML = `
    <span class="conv-item-color" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${storyColor};flex-shrink:0"></span>
    <span class="conv-item-title" title="${escHtml(conv.title)}">${escHtml(conv.title)}</span>
    <span style="display:flex;align-items:center;gap:4px">
      <span class="conv-item-date">${date}</span>
      <button class="conv-del" data-id="${conv.id}" title="Apagar">✕</button>
    </span>`;
  item.addEventListener('click', (e) => { if (!e.target.classList.contains('conv-del')) openConversation(conv.id); });
  item.querySelector('.conv-del').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Apagar "${conv.title}"?`)) return;
    await window.miar.deleteConversation(conv.id);
    if (state.currentConvId === conv.id) { state.currentConvId = null; clearChat(); }
    await loadConversationList();
  });
  return item;
}

async function loadConversationList() {
  const conversations = await window.miar.getConversations();
  const container = document.getElementById('conversations');
  container.innerHTML = '';
  if (!conversations.length) {
    container.innerHTML = '<div style="padding:16px 12px;font-size:12px;color:var(--text3)">Nenhuma conversa ainda.</div>';
    return;
  }

  // Agrupa por período
  const groups = {};
  const order = [];
  for (const conv of conversations) {
    const period = getConvPeriod(conv.updatedAt);
    if (!groups[period]) { groups[period] = []; order.push(period); }
    groups[period].push(conv);
  }

  for (const period of order) {
    const header = document.createElement('div');
    header.className = 'conv-group-header';
    header.innerHTML = `<span class="conv-group-label">ASSUNTOS:</span><span class="conv-group-period">${escHtml(period)}</span>`;
    container.appendChild(header);
    for (const conv of groups[period]) {
      container.appendChild(buildConvItem(conv));
    }
  }
}

async function openConversation(id) {
  const conv = await window.miar.getConversation(id);
  if (!conv) return;
  state.currentConvId = id;
  state.messages = (conv.messages || []).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp, attachments: m.attachments || [] }));
  await window.miar.setLastConversationId(id);
  document.getElementById('conv-title').textContent = conv.title || 'MIAR ÁRIA';
  renderMessages();
  await loadConversationList();
}

function clearChat() {
  state.messages = [];
  document.getElementById('conv-title').textContent = 'MIAR ÁRIA';
  document.getElementById('messages').innerHTML = `
    <div id="empty-state">
      <h2>MIAR ÁRIA</h2>
      <p>Assistente de computador com voz, contexto, memória e automação para cuidar de tarefas do dia a dia.</p>
      <div class="empty-hint">Configure sua chave de IA em ⚙ Configurações e comece escrevendo ou falando.</div>
    </div>`;
}

function renderMessages() {
  const container = document.getElementById('messages');
  container.innerHTML = '';
  if (!state.messages.length) { clearChat(); return; }
  for (const msg of state.messages) appendMessageEl(msg);
  scrollToBottom();
}

function setThinkingText(text) {
  const el = document.querySelector('.msg-thinking .msg-bubble');
  if (el) el.textContent = text;
}

function appendMessageEl(msg) {
  const container = document.getElementById('messages');
  document.getElementById('empty-state')?.remove();

  const div = document.createElement('div');
  div.className = `msg ${msg.role}${msg.isError ? ' msg-error' : ''}${msg.isThinking ? ' msg-thinking' : ''}`;

  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '';
  const dateFull = msg.timestamp
    ? new Date(msg.timestamp).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const attachHtml = (msg.attachments || []).length > 0
    ? `<div class="msg-attachments">${msg.attachments.map(a => `<span class="attach-tag">📎 ${escHtml(a.name || a)}</span>`).join('')}</div>`
    : '';
  const providerHtml = msg.provider ? `<span class="msg-provider">${escHtml(msg.provider)}</span>` : '';
  const msgId = 'msg-' + Math.random().toString(36).slice(2);

  div.innerHTML = `
    ${attachHtml}
    <div class="msg-bubble" id="${msgId}">${formatContent(msg.content || '')}</div>
    <div class="msg-meta">
      <span class="msg-time" title="${dateFull}">${time}</span>
      ${providerHtml}
      <button class="copy-btn" onclick="copyMsg('${msgId}')" title="Copiar texto">⧉</button>
    </div>`;

  container.appendChild(div);
  return div;
}

function formatContent(text) {
  return escHtml(text)
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg4);padding:10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0;white-space:pre-wrap">$1</pre>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg4);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scrollToBottom() {
  const c = document.getElementById('messages');
  c.scrollTop = c.scrollHeight;
}

// ── CÂMERA ────────────────────────────────────────────────────────────────────
let _cameraStream = null;

window.openCameraModal = async function () {
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById('camera-video');
    if (video) video.srcObject = _cameraStream;
    openModal('camera-modal');
  } catch (err) {
    const msgs = {
      NotAllowedError: 'Permissão de câmera negada. Ative em Configurações → Privacidade → Câmera.',
      NotFoundError: 'Nenhuma câmera encontrada.',
    };
    alert(msgs[err.name] || `Erro ao acessar câmera: ${err.message}`);
  }
};

window.closeCameraModal = function () {
  closeModal('camera-modal');
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) video.srcObject = null;
};

window.captureFromCamera = async function () {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas || !_cameraStream) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

  // Para ao stream
  window.closeCameraModal();

  // Adiciona como anexo
  state.attachments.push({
    name: '📷 captura_camera.jpg',
    type: 'image/jpeg',
    content: `[Imagem capturada pela câmera — base64 jpeg]`,
    dataUrl: dataUrl,
    isCamera: true,
  });
  renderAttachmentsPreview();
  setMicStatus('📷 Imagem capturada! Escreva o que quer que eu analise.');
  setTimeout(() => setMicStatus(''), 4000);
};

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
async function sendMessage() {
  if (state.isSending) return;
  updateActivityStatus('Pensando...', 'thinking');
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  const allAttachments = [...state.attachments, ...state.selectedFolderFiles];
  if (!text && !allAttachments.length) return;

  if (!state.currentConvId) {
    const conv = await window.miar.createConversation(text.substring(0, 60) || 'Nova conversa');
    state.currentConvId = conv.id;
    await loadConversationList();
  }

  const userMsg = { role: 'user', content: text, attachments: allAttachments, timestamp: new Date().toISOString() };
  state.messages.push(userMsg);
  appendMessageEl(userMsg);
  input.value = '';
  input.style.height = 'auto';
  clearAttachmentsPreview();

  await window.miar.saveMessage({ conversationId: state.currentConvId, role: 'user', content: text, attachments: allAttachments });

  state.isSending = true;
  document.getElementById('send-btn').disabled = true;
  const abortBtn = document.getElementById('abort-btn');
  if (abortBtn) abortBtn.style.display = 'inline-flex';

  const thinkingEl = appendMessageEl({ role: 'assistant', content: '⋯', isThinking: true, timestamp: new Date().toISOString() });
  scrollToBottom();

  try {
    let relevantMemories = [];
    if (state.memoryEnabled && text) {
      relevantMemories = await window.miar.memorySearch(text);
    }

    const apiMessages = state.messages
      .filter(m => !m.isThinking && !m.isError)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    // ── Modo Live (Streaming) — tentar primeiro, fallback para normal ──
    const USE_STREAMING = true; // Toggle: false para desativar

    if (USE_STREAMING) {
      try {
        let streamText = '';
        let streamDone = false;
        let streamError = null;

        const onStreamChunk = (data) => {
          if (data.type === 'chunk') {
            streamText += data.text;
            // Atualiza o elemento thinking com o texto acumulando
            const bubble = thinkingEl.querySelector('.msg-bubble');
            if (bubble) bubble.textContent = streamText;
            scrollToBottom();
          } else if (data.type === 'done') {
            streamDone = true;
          } else if (data.type === 'error') {
            streamError = data.error;
            streamDone = true;
          }
        };

        const unlisten = () => {
          // Remove o listener após uso
        };

        // Registra listener temporário
        const handler = (data) => {
          if (data.type === 'chunk' && streamText === '' && !streamDone) return;
          onStreamChunk(data);
        };

        // Usa o IPC de streaming
        window.miar.onAiStream((data) => {
          // Só processa se estamos no modo streaming atual
          if (state._streamingActive) onStreamChunk(data);
        });

        state._streamingActive = true;
        const result = await window.miar.sendStreamMessage({
          messages: apiMessages,
          conversationId: state.currentConvId,
          attachments: allAttachments.filter(a => a.content),
          memories: relevantMemories,
          customInstructions: state.customInstructions || '',
        });
        state._streamingActive = false;

        if (result?.ok && result.streaming) {
          // Resposta via streaming — já renderizada em tempo real
          thinkingEl.remove();
          const aiMsg = {
            role: 'assistant',
            content: result.text,
            provider: result.provider || '',
            timestamp: new Date().toISOString(),
            isError: false,
          };
          state.messages.push(aiMsg);
          appendMessageEl(aiMsg);
          await window.miar.saveMessage({ conversationId: state.currentConvId, role: 'assistant', content: aiMsg.content, attachments: [] });
          if (state.ttsEnabled) speak(result.text);
          await loadConversationList();
          return; // Sai da função
        }

        // Se chegou aqui, streaming falhou — usa modo normal
      } catch {}
    }

    // ── Modo Normal (sem streaming) ──
    // ── Loop de execução de comandos Windows ──────────────────────────────────
    // A IA pode responder com [CMD: powershell_command] → app executa → devolve resultado → IA continua
    let loopMessages = [...apiMessages];
    let finalResult  = null;
    let loopCount    = 0;
    const MAX_CMD_LOOPS = 50;

    while (loopCount < MAX_CMD_LOOPS) {
      loopCount++;
      const result = await window.miar.sendMessage({
        messages: loopMessages,
        conversationId: state.currentConvId,
        attachments: loopCount === 1 ? allAttachments.filter(a => a.content) : [],
        memories: loopCount === 1 ? relevantMemories : [],
        customInstructions: loopCount === 1 ? (state.customInstructions || '') : '',
      });

      if (!result.ok) { finalResult = result; break; }

      // Detecta marcadores [CMD: ...]
      const cmdMatches = [...(result.text.matchAll(/\[CMD:\s*([\s\S]+?)\]/g))];

      if (!cmdMatches.length) {
        // Sem comandos — resposta final
        finalResult = result;
        break;
      }

      // Tem comandos — executar todos e coletar resultados
      const execResults = [];
      for (const match of cmdMatches) {
        const cmd = match[1].trim();
        setThinkingText(`⚙ Executando: ${cmd.substring(0, 60)}…`);
        updateActivityStatus('Executando comando no sistema...', 'thinking');
        const execRes = await window.miar.runCommand(cmd);
        execResults.push({
          command: cmd,
          ok: execRes.ok,
          output: execRes.stdout || execRes.stderr || '(sem output)',
          exitCode: execRes.exitCode,
        });
      }

      // Monta mensagem de retorno dos resultados ao contexto da IA
      const cmdFeedback = execResults.map(r =>
        `[RESULTADO_CMD: ${r.command}]\n${r.ok ? '✓ Saída:' : '✗ Erro (código ' + r.exitCode + '):'}\n${r.output}`
      ).join('\n\n---\n\n');

      // Adiciona resposta parcial da IA + resultados ao contexto e continua o loop
      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: result.text },
        { role: 'user', content: `[SISTEMA — resultados dos comandos executados no Windows]\n\n${cmdFeedback}\n\nContinue com base nos resultados acima.` },
      ];

      setThinkingText('⋯ Processando resultados…');
    }

    thinkingEl.remove();

    if (!finalResult) {
      finalResult = { ok: false, error: 'Limite de loops de comando atingido.' };
    }

    const aiMsg = {
      role: 'assistant',
      content: finalResult.ok ? finalResult.text : finalResult.error,
      provider: finalResult.provider || '',
      timestamp: new Date().toISOString(),
      isError: !finalResult.ok,
    };
    state.messages.push(aiMsg);
    appendMessageEl(aiMsg);

    await window.miar.saveMessage({ conversationId: state.currentConvId, role: 'assistant', content: aiMsg.content, attachments: [] });
    await loadConversationList();

    if (finalResult.ok) {
      if (state.ttsEnabled) speak(finalResult.text);
      if (state.memoryEnabled && state.messages.length >= 2) {
        const snippet = state.messages.slice(-4).map(m => `${m.role === 'user' ? 'Usuário' : 'MIAR ÁRIA'}: ${m.content}`).join('\n');
        window.miar.memoryExtract({ snippet }).catch(() => {});
      }
      if (state.messages.filter(m => m.role === 'user').length === 1) {
        const newTitle = text.substring(0, 60) + (text.length > 60 ? '…' : '');
        await window.miar.updateConversationTitle({ id: state.currentConvId, title: newTitle });
        document.getElementById('conv-title').textContent = newTitle;
        await loadConversationList();
      }
    }
  } catch (e) {
    thinkingEl?.remove();
    appendMessageEl({ role: 'assistant', content: `Erro inesperado: ${e.message}`, isError: true, timestamp: new Date().toISOString() });
  } finally {
    state.isSending = false;
    document.getElementById('send-btn').disabled = false;
    updateActivityStatus('Pronta', 'idle');
    const abortBtnFinal = document.getElementById('abort-btn');
    if (abortBtnFinal) abortBtnFinal.style.display = 'none';
    refreshApiCounter();
    scrollToBottom();
  }
}

// ── DRAG & DROP NOS BOTÕES ──────────────────────────────────────────────────
function setupDraggableButtons() {
  const btns = document.querySelectorAll('#input-row .icon-btn');
  btns.forEach(btn => {
    btn.draggable = true;
    btn.classList.add('draggable');

    btn.addEventListener('dragstart', (e) => {
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', btn.id);
    });

    btn.addEventListener('dragend', () => {
      btn.classList.remove('dragging');
      document.querySelectorAll('.dragged-over').forEach(b => b.classList.remove('dragged-over'));
    });

    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      btn.classList.add('dragged-over');
    });

    btn.addEventListener('dragleave', () => {
      btn.classList.remove('dragged-over');
    });

    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('dragged-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId === btn.id) return;

      const draggedBtn = document.getElementById(draggedId);
      if (!draggedBtn) return;

      // Troca a posição
      const parent = btn.parentElement;
      const draggedIndex = Array.from(parent.children).indexOf(draggedBtn);
      const targetIndex = Array.from(parent.children).indexOf(btn);

      if (draggedIndex < targetIndex) {
        parent.insertBefore(draggedBtn, btn.nextSibling);
      } else {
        parent.insertBefore(draggedBtn, btn);
      }
    });
  });
}

// ── MICROPHONE — Whisper (Groq) via MediaRecorder ────────────────────────────
let _mediaRecorder   = null;
let _audioChunks     = [];
let _silenceInterval = null;

function setupMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const btn = document.getElementById('mic-btn');
    if (btn) { btn.title = 'Microfone não disponível.'; btn.style.opacity = '0.4'; }
  }
  setupSpeechRecognition();
}

function setupSpeechRecognition() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor || state.speechRecognition) return;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.voiceInputActive = true;
    state.isListening = true;
    document.getElementById('mic-btn')?.classList.add('listening');
    setMicStatus('🎙 Ouvindo…');
    updateActivityStatus('Ouvindo por voz...', 'listen');
  };

  recognition.onerror = (event) => {
    state.voiceInputActive = false;
    state.isListening = false;
    document.getElementById('mic-btn')?.classList.remove('listening');
    const msg = event.error === 'not-allowed' ? 'Permissão de microfone negada.' : `Erro de voz: ${event.error}`;
    setMicStatus(msg);
    updateActivityStatus('Pronta', 'idle');
  };

  recognition.onend = () => {
    state.voiceInputActive = false;
    state.isListening = false;
    document.getElementById('mic-btn')?.classList.remove('listening');
    setMicStatus('');
    updateActivityStatus('Pronta', 'idle');
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0]?.transcript || '')
      .join(' ')
      .trim();

    if (!transcript) return;
    setMicStatus(`🎙 ${transcript}`);

    const finalTranscript = Array.from(event.results)
      .filter(r => r.isFinal)
      .map(r => r[0]?.transcript || '')
      .join(' ')
      .trim();

    if (!finalTranscript) return;

    const input = document.getElementById('message-input');
    if (input) {
      input.value = finalTranscript;
      autoResizeTextarea(input);
    }

    updateActivityStatus('Enviando comando por voz...', 'thinking');
    sendMessage().catch(() => {
      updateActivityStatus('Pronta', 'idle');
    });
  };

  state.speechRecognition = recognition;
}

async function toggleMic() {
  if (state.voiceInputActive) {
    state.speechRecognition?.stop();
    return;
  }

  if (state.speechRecognition) {
    // Evita usar o SpeechRecognition nativo no Electron, pois ele pode encerrar
    // sem transcrever nada e fazer o botão sumir sem resultado.
    state.speechRecognition = null;
  }

  if (state.isListening) {
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';

    _mediaRecorder = new MediaRecorder(stream, { mimeType });
    _audioChunks   = [];

    _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _audioChunks.push(e.data); };

    _mediaRecorder.onstop = async () => {
      clearInterval(_silenceInterval);
      stream.getTracks().forEach(t => t.stop());
      state.isListening = false;
      document.getElementById('mic-btn').classList.remove('listening');

      if (!_audioChunks.length) { setMicStatus(''); return; }

      setMicStatus('🔄 Transcrevendo com Whisper…');
      try {
        const blob   = new Blob(_audioChunks, { type: mimeType });
        const buffer = await blob.arrayBuffer();
        const text   = await window.miar.transcribeAudio(buffer, mimeType);
        if (text && text.trim()) {
          const input = document.getElementById('message-input');
          input.value = text.trim();
          autoResizeTextarea(input);
          setMicStatus('');
          sendMessage();
        } else {
          setMicStatus('Nenhuma fala detectada. Tente novamente.');
          setTimeout(() => setMicStatus(''), 3000);
        }
      } catch (err) {
        setMicStatus(`Erro Whisper: ${(err.message || '').substring(0, 60)}`);
        setTimeout(() => setMicStatus(''), 5000);
      }
    };

    // Detecção de silêncio via AudioContext
    const audioCtx = new AudioContext();
    const src      = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const dataArr = new Uint8Array(analyser.frequencyBinCount);
    let silenceFrames = 0;

    _silenceInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArr);
      const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
      if (avg < 8) {
        silenceFrames++;
        if (silenceFrames >= 4) {
          clearInterval(_silenceInterval);
          audioCtx.close();
          if (_mediaRecorder && _mediaRecorder.state === 'recording') _mediaRecorder.stop();
        }
      } else {
        silenceFrames = 0;
      }
    }, 500);

    _mediaRecorder.start(100);
    state.isListening = true;
    document.getElementById('mic-btn').classList.add('listening');
    setMicStatus('🎙 Ouvindo… (clique para parar)');

  } catch (err) {
    const msgs = {
      NotAllowedError : 'Permissão de microfone negada. Ative em Configurações → Privacidade → Microfone.',
      NotFoundError   : 'Nenhum microfone encontrado.',
    };
    setMicStatus(msgs[err.name] || `Erro: ${err.message}`);
    setTimeout(() => setMicStatus(''), 5000);
  }
}

function setMicStatus(msg, extraClass = '') {
  const el = document.getElementById('mic-status');
  el.textContent = msg;
  el.className = 'mic-status' + (msg ? ' visible' : '') + (extraClass ? ' ' + extraClass : '');
}

// ── AI STATUS ─────────────────────────────────────────────────────────────────
async function updateAiStatus() {
  const el = document.getElementById('ai-status');
  try {
    const s = await window.miar.getKeyStatus();
    const total = (s.groq?.count || 0) + (s.gemini?.count || 0) + (s.openrouter?.count || 0) + (s.mistral?.count || 0);
    if (total === 0) { el.textContent = 'Sem chave'; el.className = 'ai-status error'; return; }
    const parts = [];
    if (s.groq?.count)       parts.push(`Groq×${s.groq.count}`);
    if (s.gemini?.count)     parts.push(`Gemini×${s.gemini.count}`);
    if (s.mistral?.count)    parts.push(`Mistral×${s.mistral.count}`);
    if (s.openrouter?.count) parts.push(`OR×${s.openrouter.count}`);
    el.textContent = parts.join(' · ');
    el.className = 'ai-status ok';
  } catch { el.textContent = 'Erro'; el.className = 'ai-status error'; }
}

// ── ATTACHMENTS ───────────────────────────────────────────────────────────────
async function handleAttach() {
  const result = await window.miar.selectFiles();
  if (result.canceled || !result.files.length) return;
  result.files.forEach(f => state.attachments.push(f));
  renderAttachmentsPreview();
}

async function handleFolder() {
  const result = await window.miar.selectFolder();
  if (result.canceled) return;
  state.folderPath = result.folderPath;
  state.folderFiles = result.files || [];
  openFolderModal();
}

function renderAttachmentsPreview() {
  const container = document.getElementById('attachments-preview');
  container.innerHTML = '';
  state.attachments.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = 'attach-preview-item';
    item.innerHTML = `📎 ${escHtml(a.name)}<button onclick="removeAttachment(${i})">✕</button>`;
    container.appendChild(item);
  });
  if (state.selectedFolderFiles.length > 0) {
    const fp = document.createElement('div');
    fp.className = 'folder-preview';
    fp.innerHTML = `📁 ${state.selectedFolderFiles.length} arquivo(s) de pasta<button onclick="clearFolderFiles()">✕</button>`;
    container.appendChild(fp);
  }
}

window.removeAttachment = (i) => { state.attachments.splice(i, 1); renderAttachmentsPreview(); };
window.clearFolderFiles = () => { state.selectedFolderFiles = []; renderAttachmentsPreview(); };

function clearAttachmentsPreview() {
  state.attachments = [];
  state.selectedFolderFiles = [];
  document.getElementById('attachments-preview').innerHTML = '';
}

// ── FOLDER MODAL ──────────────────────────────────────────────────────────────
function openFolderModal() {
  document.getElementById('folder-path-label').textContent = state.folderPath || '';
  const list = document.getElementById('folder-files-list');
  list.innerHTML = '';
  if (!state.folderFiles.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px">Pasta vazia.</div>';
  }
  for (const file of state.folderFiles) {
    const item = document.createElement('div');
    item.className = 'folder-file-item';
    item.dataset.path = file.path;
    const icons = { '.pdf': '📄', '.docx': '📝', '.txt': '📃', '.md': '📋', '.json': '🔧', '.png': '🖼', '.jpg': '🖼', '.jpeg': '🖼' };
    const icon = file.isDirectory ? '📁' : (icons[file.type] || '📄');
    const size = file.size ? ` — ${Math.round(file.size / 1024)}KB` : '';
    item.innerHTML = `<span>${icon}</span><span class="folder-file-name">${escHtml(file.name)}</span><span class="folder-file-size">${file.type || ''}${size}</span>`;
    item.addEventListener('click', () => {
      item.classList.toggle('selected');
      const sel = list.querySelectorAll('.selected');
      document.getElementById('folder-selected-count').textContent = `${sel.length} selecionado(s)`;
    });
    list.appendChild(item);
  }
  openModal('folder-modal');
}

window.confirmFolderFiles = async function () {
  const selected = document.querySelectorAll('#folder-files-list .selected');
  const files = [];
  for (const el of selected) files.push(await window.miar.readFolderFile(el.dataset.path));
  state.selectedFolderFiles = files;
  closeModal('folder-modal');
  renderAttachmentsPreview();
};

// ── MODALS ────────────────────────────────────────────────────────────────────
window.openSettingsModal = async function () {
  await loadSettings();
  loadVoices();
  openModal('settings-modal');
};

window.openMaintenanceModal = async function () {
  openModal('maintenance-modal');
  const [structure, logs] = await Promise.all([window.miar.getAppStructure(), window.miar.getLogs()]);
  document.getElementById('maintenance-structure').textContent =
    (structure.structure || []).map(e => `${e.type === 'dir' ? '📁' : '📄'} ${e.path}${e.size ? ` (${Math.round(e.size / 1024)}KB)` : ''}`).join('\n') || 'Sem dados.';
  document.getElementById('maintenance-logs').textContent = logs.logs || 'Sem logs.';
};

window.runMaintenanceDiagnosis = async function () {
  const prompt = document.getElementById('maintenance-prompt').value.trim();
  if (!prompt) return;
  const result = document.getElementById('maintenance-result');
  result.textContent = 'Analisando com IA…';
  const [structure, logs] = await Promise.all([window.miar.getAppStructure(), window.miar.getLogs()]);
  const context = `Estrutura:\n${(structure.structure || []).slice(0, 40).map(e => e.path).join('\n')}\n\nLogs:\n${(logs.logs || '').slice(-500)}`;
  const res = await window.miar.sendMessage({
    messages: [{ role: 'user', content: `Problema: ${prompt}\n\n${context}\n\nDiagnostique e sugira correções. Seja honesta. Não altere arquivos — apenas sugira para revisão.` }],
    memories: [],
  });
  result.textContent = res.ok ? res.text : `Erro: ${res.error}`;
};

window.createBackup = async function () {
  const status = document.getElementById('backup-status');
  status.textContent = 'Criando backup…';
  const res = await window.miar.createBackup();
  status.textContent = res.ok ? `✓ Backup criado (${res.conversationCount} conversa(s))` : `✗ ${res.error}`;
};

// ── MEMORY ────────────────────────────────────────────────────────────────────
window.openMemoryModal = async function () {
  openModal('memory-modal');
  await loadMemories();
};

window.loadMemories = async function (category = 'todas', query = '') {
  const stats = await window.miar.memoryStats();
  const memories = await window.miar.memoryGet({ category: category !== 'todas' ? category : undefined, query });
  const statsEl = document.getElementById('memory-stats');
  if (statsEl) statsEl.textContent = `Total: ${stats.total} memória${stats.total !== 1 ? 's' : ''}`;
  const container = document.getElementById('memory-list');
  if (!container) return;
  container.innerHTML = '';
  if (!memories.length) {
    container.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px">Nenhuma memória encontrada.</div>';
    return;
  }
  for (const mem of memories) {
    const item = document.createElement('div');
    item.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start;margin-bottom:6px';
    item.innerHTML = `
      <div style="flex:1">
        <div style="font-size:13px;color:var(--text)">${escHtml(mem.content)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${mem.category} · ${new Date(mem.updatedAt).toLocaleDateString('pt-BR')} · ${mem.hits || 1}× usado</div>
      </div>
      <button onclick="window.deleteMemory('${mem.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;flex-shrink:0" title="Apagar">✕</button>`;
    container.appendChild(item);
  }
};

window.deleteMemory = async function (id) {
  await window.miar.memoryDelete(id);
  const cat = document.getElementById('memory-category-filter')?.value || 'todas';
  const q = document.getElementById('memory-search-input')?.value || '';
  await window.loadMemories(cat, q);
};

window.clearAllMemories = async function () {
  if (!confirm('Apagar TODAS as memórias? Esta ação não pode ser desfeita.')) return;
  await window.miar.memoryClearAll();
  await window.loadMemories();
};

// ── COPY MESSAGE ──────────────────────────────────────────────────────────────
window.copyMsg = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.innerText || el.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.parentElement?.querySelector('.copy-btn');
    if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⧉'; }, 1500); }
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  });
};

// ── UPDATER NOTIFICATIONS ─────────────────────────────────────────────────────
if (window.miar?.onUpdaterStatus) {
  window.miar.onUpdaterStatus((data) => {
    const bar = document.getElementById('update-bar');
    const span = bar?.querySelector('span');
    if (data.type === 'available') {
      if (bar) { bar.style.display = 'flex'; }
      if (span) span.textContent = `⬇ Nova versão ${data.version} — baixando…`;
    } else if (data.type === 'progress') {
      if (bar) { bar.style.display = 'flex'; }
      if (span) span.textContent = `⬇ Baixando atualização… ${data.percent}%`;
    } else if (data.type === 'downloaded') {
      if (bar) { bar.style.display = 'flex'; }
      if (span) span.textContent = `⬆ Versão ${data.version} pronta — clique para instalar`;
    } else if (data.type === 'error') {
      if (span) span.textContent = `⚠ Erro ao atualizar: ${data.message?.substring(0, 60)}`;
      if (bar) { bar.style.display = 'flex'; }
    }
  });
}

// ── MODAL HELPERS ─────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
window.closeModal = function (id) { document.getElementById(id)?.classList.add('hidden'); };

// ── EVENT LISTENERS ───────────────────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('new-conv-btn').addEventListener('click', async () => {
    const conv = await window.miar.createConversation('Nova conversa');
    state.currentConvId = conv.id;
    state.messages = [];
    clearChat();
    await loadConversationList();
  });

  document.getElementById('send-btn').addEventListener('click', sendMessage);

  const abortBtn = document.getElementById('abort-btn');
  if (abortBtn) {
    abortBtn.addEventListener('click', async () => {
      await window.miar.abortRequest();
      abortBtn.style.display = 'none';
      state.isSending = false;
      document.getElementById('send-btn').disabled = false;
      const thinking = document.querySelector('.msg-thinking');
      if (thinking) {
        thinking.remove();
        appendMessageEl({ role: 'assistant', content: '— Resposta cancelada pelo usuário.', isError: false, timestamp: new Date().toISOString() });
      }
      scrollToBottom();
    });
  }

  const msgInput = document.getElementById('message-input');
  msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  msgInput.addEventListener('input', function () { autoResizeTextarea(this); });

  document.getElementById('toggle-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));
  document.getElementById('agent-monitor-btn').addEventListener('click', window.openAgentMonitor);
  document.getElementById('settings-btn').addEventListener('click', window.openSettingsModal);
  // maintenance-btn foi movido para dentro do modal de settings
  document.getElementById('attach-btn').addEventListener('click', handleAttach);
  document.getElementById('folder-btn').addEventListener('click', handleFolder);
  document.getElementById('camera-btn').addEventListener('click', window.openCameraModal);
  document.getElementById('mic-btn').addEventListener('click', toggleMic);

  // ── Drag & Drop nos botões ──
  setupDraggableButtons();

  document.getElementById('tts-btn').addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    updateTtsBtn();
    if (!state.ttsEnabled) speechSynthesis.cancel();
    window.miar.saveSettings({ ttsEnabled: state.ttsEnabled });
  });

  document.getElementById('conv-title').addEventListener('click', async () => {
    if (!state.currentConvId) return;
    const cur = document.getElementById('conv-title').textContent;
    const newTitle = prompt('Renomear história:', cur);
    if (newTitle?.trim()) {
      await window.miar.updateConversationTitle({ id: state.currentConvId, title: newTitle.trim() });
      document.getElementById('conv-title').textContent = newTitle.trim();
      await loadConversationList();
    }
  });

  // Duplo clique no título para mudar cor da história
  document.getElementById('conv-title').addEventListener('dblclick', async () => {
    if (!state.currentConvId) return;
    const colors = ['#27AE60', '#2ECC71', '#3498DB', '#9B59B6', '#E74C3C', '#F39C12', '#1ABC9C', '#E91E63'];
    const choice = prompt('Escolha uma cor (1-8):\n1: Verde medicina\n2: Verde claro\n3: Azul\n4: Roxo\n5: Vermelho\n6: Laranja\n7: Ciano\n8: Rosa');
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < colors.length) {
      await window.miar.updateConversationColor({ id: state.currentConvId, color: colors[idx] });
      await loadConversationList();
    }
  });

  document.getElementById('search-box').addEventListener('input', async function () {
    const q = this.value.trim();
    if (!q) { await loadConversationList(); return; }
    const results = await window.miar.searchConversations(q);
    const container = document.getElementById('conversations');
    container.innerHTML = results.length
      ? results.map(r => `<div class="conv-item" onclick="openConversation('${r.id}')"><span class="conv-item-title">${escHtml(r.title)}</span></div>`).join('')
      : '<div style="padding:12px;font-size:12px;color:var(--text3)">Sem resultados.</div>';
  });

  document.getElementById('tts-rate').addEventListener('input', function () {
    document.getElementById('tts-rate-val').textContent = this.value;
    state.ttsRate = parseFloat(this.value);
  });
  document.getElementById('tts-pitch').addEventListener('input', function () {
    document.getElementById('tts-pitch-val').textContent = this.value;
    state.ttsPitch = parseFloat(this.value);
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

function updateTtsBtn() {
  const btn = document.getElementById('tts-btn');
  btn.textContent = state.ttsEnabled ? '🔊' : '🔇';
  btn.classList.toggle('active', state.ttsEnabled);
  btn.title = state.ttsEnabled ? 'Voz ligada (clique para desligar)' : 'Voz desligada (clique para ligar)';
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  // Estilo Replit: cresce conforme digita, máx 200px, volta a 1 linha quando vazio
  if (!el.value.trim()) {
    el.style.height = 'auto';
  } else {
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }
}
