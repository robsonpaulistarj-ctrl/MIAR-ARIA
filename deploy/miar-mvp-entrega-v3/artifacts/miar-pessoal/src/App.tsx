import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent } from 'react';
import {
  AudioLines,
  BookOpen,
  Bot,
  Camera,
  CameraOff,
  Check,
  Clock3,
  Copy,
  Grip,
  Layers3,
  Menu,
  Mic,
  MicOff,
  Moon,
  Pause,
  Play,
  Plus,
  Send,
  Settings2,
  Sparkles,
  Square,
  SunMedium,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import {
  createRemoteConversation,
  createRemoteStory,
  getCurrentUser,
  getRemoteConversation,
  listRemoteConversations,
  listRemoteStories,
  sendRemoteMessage,
  subscribeRemoteConversation,
  uploadRemoteAttachment,
  type RemoteAttachment,
  type RemoteConversation,
  type RemoteStory,
  login,
} from '@/lib/api';

const queryClient = new QueryClient();
const publicAccess = import.meta.env.VITE_PUBLIC_ACCESS === 'true' || (import.meta.env.PROD && import.meta.env.VITE_PUBLIC_ACCESS !== 'false');
const authRequired = !publicAccess && import.meta.env.VITE_AUTH_REQUIRED === 'true';

type ProviderModel = {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  visible: boolean;
  freeRequests: number;
  color: string;
};

type Story = {
  id: string;
  name: string;
  description: string;
  color: string;
  readAllBeforeAnswer: boolean;
  createdAt: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: RemoteAttachment[];
};

type Conversation = {
  id: string;
  storyId: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

type MemoryItem = {
  id: string;
  content: string;
  createdAt: string;
};

type AttachmentFile = {
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
  remote?: RemoteAttachment;
};

const defaultProviders: ProviderModel[] = [
  { id: 'groq-1', provider: 'Groq', name: 'Llama 3.1', enabled: true, visible: true, freeRequests: 20, color: '#5BA35A' },
  { id: 'gemini-1', provider: 'Gemini', name: 'Gemini 2.0', enabled: true, visible: true, freeRequests: 20, color: '#4C7DFF' },
  { id: 'mistral-1', provider: 'Mistral', name: 'Mistral Large', enabled: false, visible: true, freeRequests: 20, color: '#7C4DFF' },
  { id: 'openrouter-1', provider: 'OpenRouter', name: 'OpenRouter Mix', enabled: true, visible: true, freeRequests: 20, color: '#FF9F43' },
];

const initialStories: Story[] = [
  {
    id: 'story-1',
    name: 'Minha primeira história',
    description: 'Conte sobre a sua história para a IA aprender o contexto da sua jornada.',
    color: '#3F8F4F',
    readAllBeforeAnswer: true,
    createdAt: 'agora',
  },
];

const mapRemoteStory = (story: RemoteStory): Story => ({
  id: story.id,
  name: story.name,
  description: story.description,
  color: story.color,
  readAllBeforeAnswer: story.readAllBeforeAnswer,
  createdAt: story.createdAt,
});

const mapRemoteConversation = (conversation: RemoteConversation): Conversation => ({
  id: conversation.id,
  storyId: conversation.storyId,
  title: conversation.title,
  createdAt: conversation.createdAt,
  messages: (conversation.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content,
    createdAt: message.createdAt,
    attachments: message.attachments,
  })),
});

const formatTimestamp = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatLongDate = (date: Date) => date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

const buildConversationTitle = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Nova conversa';
  return normalized.length > 42 ? `${normalized.slice(0, 39).trimEnd()}…` : normalized;
};

function readStoredJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

const createMessage = (role: 'user' | 'assistant', content: string, attachments: AttachmentFile[] = []) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
  attachments: attachments.map(({ name, type, size }) => ({ name, type, size })),
});

function Home() {
  const [isDark, setIsDark] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [selectedStoryId, setSelectedStoryId] = useState(initialStories[0]?.id ?? 'story-1');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [providers, setProviders] = useState<ProviderModel[]>(defaultProviders);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [readAllStories, setReadAllStories] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [voiceRate, setVoiceRate] = useState(1);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showNewStoryModal, setShowNewStoryModal] = useState(false);
  const [newStoryName, setNewStoryName] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');
  const [newStoryColor, setNewStoryColor] = useState('#3F8F4F');
  const [newStoryReadAll, setNewStoryReadAll] = useState(true);
  const [draggingControlBar, setDraggingControlBar] = useState(false);
  const [controlBarPosition, setControlBarPosition] = useState({ x: 24, y: 24 });
  const [draggingHelper, setDraggingHelper] = useState(false);
  const [helperPosition, setHelperPosition] = useState({ x: 24, y: 140 });
  const [copiedAll, setCopiedAll] = useState(false);
  const [useAllHistory, setUseAllHistory] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'local' | 'connected' | 'error'>('local');
  const [backendError, setBackendError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!authRequired);
  const [authEmail, setAuthEmail] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const idleTimerRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const activeStory = useMemo(() => stories.find((story) => story.id === selectedStoryId) ?? stories[0], [selectedStoryId, stories]);
  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null, [conversations, selectedConversationId]);

  useEffect(() => {
    const savedStories = readStoredJson<Story[] | null>('miar-ai-stories', null);
    const savedProviders = readStoredJson<ProviderModel[] | null>('miar-ai-providers', null);
    const savedConversations = readStoredJson<Conversation[] | null>('miar-ai-conversations', null);
    const savedMemories = readStoredJson<MemoryItem[] | null>('miar-ai-memories', null);
    const savedSettings = readStoredJson<Partial<{ isLiveMode: boolean; readAllStories: boolean; voiceRate: number; voiceEnabled: boolean; isDark: boolean }> | null>('miar-ai-settings', null);

    if (savedStories) setStories(savedStories);
    if (savedProviders) setProviders(savedProviders);
    if (savedConversations) {
      setConversations(savedConversations);
      if (savedConversations[0]) setSelectedConversationId(savedConversations[0].id);
    }
    if (savedMemories) setMemories(savedMemories);
    if (savedSettings) {
      setIsLiveMode(savedSettings.isLiveMode ?? true);
      setReadAllStories(savedSettings.readAllStories ?? true);
      setVoiceRate(savedSettings.voiceRate ?? 1);
      setVoiceEnabled(savedSettings.voiceEnabled ?? true);
      setIsDark(savedSettings.isDark ?? false);
    }

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('miar-ai-sync') : null;
    channelRef.current = channel;
    if (channel) channel.onmessage = (event) => {
      if (event.data?.type === 'sync-state') {
        setStories(event.data.stories ?? []);
        setConversations(event.data.conversations ?? []);
        setMemories(event.data.memories ?? []);
        setProviders(event.data.providers ?? defaultProviders);
        setSelectedConversationId(event.data.selectedConversationId ?? null);
      }
    };

    const recognitionCtor = (window as typeof window & {
      webkitSpeechRecognition?: new () => any;
      SpeechRecognition?: new () => any;
    }).SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

    if (recognitionCtor) {
      const recognition = new recognitionCtor();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0]?.transcript)
          .join(' ')
          .trim();
        if (transcript) {
          setDraft(transcript);
          if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = window.setTimeout(() => {
            recognition.stop();
            setIsListening(false);
          }, 3000);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    return () => {
      channel?.close();
      recognitionRef.current?.stop?.();
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('miar-ai-stories', JSON.stringify(stories));
    window.localStorage.setItem('miar-ai-providers', JSON.stringify(providers));
    window.localStorage.setItem('miar-ai-conversations', JSON.stringify(conversations));
    window.localStorage.setItem('miar-ai-memories', JSON.stringify(memories));
    window.localStorage.setItem('miar-ai-settings', JSON.stringify({ isLiveMode, readAllStories, voiceRate, voiceEnabled, isDark }));
    channelRef.current?.postMessage({ type: 'sync-state', stories, conversations, memories, providers, selectedConversationId });
  }, [stories, providers, conversations, memories, isLiveMode, readAllStories, voiceRate, voiceEnabled, isDark, selectedConversationId]);

  useEffect(() => {
    let cancelled = false;

    const syncRemoteState = async () => {
      try {
        if (authRequired) await getCurrentUser();
        let remoteStories = await listRemoteStories();
        if (!remoteStories.length) {
          const seeded = await createRemoteStory({
            name: initialStories[0].name,
            description: initialStories[0].description,
            color: initialStories[0].color,
            readAllBeforeAnswer: initialStories[0].readAllBeforeAnswer,
          });
          remoteStories = [seeded];
        }
        const nextStories = remoteStories.map(mapRemoteStory);
        const nextSelectedStoryId = nextStories.some((story) => story.id === selectedStoryId)
          ? selectedStoryId
          : nextStories[0]?.id;
        const remoteConversationSummaries = await listRemoteConversations(nextSelectedStoryId);
        const remoteConversations = await Promise.all(remoteConversationSummaries.map((conversation) => getRemoteConversation(conversation.id)));
        const nextConversations = remoteConversations.map(mapRemoteConversation);
        if (cancelled) return;
        setStories(nextStories);
        setSelectedStoryId(nextSelectedStoryId ?? nextStories[0]?.id ?? 'story-1');
        setConversations(nextConversations);
        setSelectedConversationId(nextConversations[0]?.id ?? null);
        setBackendStatus('connected');
        setBackendError(null);
      } catch (error) {
        if (cancelled) return;
        setBackendStatus('error');
        if (authRequired) setAuthReady(false);
        setBackendError(error instanceof Error ? error.message : 'Backend indisponível; usando o modo local.');
      }
    };

    void syncRemoteState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (backendStatus !== 'connected' || !selectedStoryId) return;
    let cancelled = false;

    const syncStoryConversations = async () => {
      try {
        const summaries = await listRemoteConversations(selectedStoryId);
        const fullConversations = await Promise.all(summaries.map((conversation) => getRemoteConversation(conversation.id)));
        if (cancelled) return;
        const nextConversations = fullConversations.map(mapRemoteConversation);
        setConversations(nextConversations);
        setSelectedConversationId((current) => nextConversations.some((conversation) => conversation.id === current)
          ? current
          : nextConversations[0]?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        setBackendStatus('error');
        setBackendError(error instanceof Error ? error.message : 'Não foi possível sincronizar as conversas.');
      }
    };

    void syncStoryConversations();
    return () => {
      cancelled = true;
    };
  }, [backendStatus, selectedStoryId]);

  useEffect(() => {
    if (backendStatus !== 'connected' || !selectedConversationId) return;
    let active = true;
    const unsubscribe = subscribeRemoteConversation(selectedConversationId, (conversationId) => {
      if (!active || conversationId !== selectedConversationId) return;
      void getRemoteConversation(conversationId)
        .then((full) => {
          if (!active) return;
          const nextConversation = mapRemoteConversation(full);
          setConversations((current) => {
            const exists = current.some((conversation) => conversation.id === nextConversation.id);
            if (!exists) return [nextConversation, ...current];
            return current.map((conversation) => conversation.id === nextConversation.id ? nextConversation : conversation);
          });
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [backendStatus, selectedConversationId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(220, textareaRef.current.scrollHeight)}px`;
    }
  }, [draft]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    if (!cameraOpen) {
      cameraStream?.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraOpen, cameraStream]);

  const saveMemory = (content: string) => {
    const value = content.trim();
    if (!value) return;
    const item: MemoryItem = { id: `${Date.now()}`, content: value, createdAt: new Date().toISOString() };
    setMemories((current) => [item, ...current]);
  };

  const toggleCamera = async () => {
    if (cameraOpen) {
      setCameraOpen(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Sua plataforma não suporta câmera neste navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      window.alert('Não foi possível abrir a câmera.');
    }
  };

  const captureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraStream || video.videoWidth === 0 || video.videoHeight === 0) {
      window.alert('A câmera ainda não está pronta para capturar uma imagem.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const name = `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    canvas.toBlob((blob) => {
      if (!blob) {
        window.alert('Não foi possível criar a imagem capturada.');
        return;
      }
      const file = new File([blob], name, { type: 'image/jpeg' });
      setAttachments((current) => [
        ...current,
        { file, name: file.name, type: file.type, size: file.size, previewUrl: URL.createObjectURL(file) },
      ]);
    }, 'image/jpeg', 0.82);
    setCameraOpen(false);
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      window.alert('Reconhecimento de voz não está disponível neste navegador.');
      return;
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  const speakText = (text: string) => {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find((voice) => /femin|female|brasil|brazil/i.test(voice.name)) ?? voices[0];
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.lang = 'pt-BR';
    utterance.rate = voiceRate;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    } else {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    }
  };

  const stopSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    try {
      await login({ email: authEmail, token: authToken });
      setAuthReady(true);
      window.location.reload();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível iniciar a sessão.');
    }
  };

  const createStory = async () => {
    if (!newStoryName.trim()) return;
    const input = {
      name: newStoryName.trim(),
      description: newStoryDescription.trim() || 'Uma nova história para organizar o seu contexto.',
      color: newStoryColor,
      readAllBeforeAnswer: newStoryReadAll,
    };
    let story: Story = {
      id: `story-${Date.now()}`,
      ...input,
      createdAt: new Date().toISOString(),
    };

    if (backendStatus === 'connected') {
      try {
        story = mapRemoteStory(await createRemoteStory(input));
        setBackendError(null);
      } catch (error) {
        setBackendStatus('error');
        setBackendError(error instanceof Error ? error.message : 'Não foi possível gravar a história remotamente.');
      }
    }

    setStories((current) => [story, ...current]);
    setSelectedStoryId(story.id);
    setShowNewStoryModal(false);
    setNewStoryName('');
    setNewStoryDescription('');
    setNewStoryColor('#3F8F4F');
    setNewStoryReadAll(true);
  };

  const createConversation = async (title: string) => {
    const story = activeStory ?? stories[0];
    if (!story) return;
    let conversation: Conversation = {
      id: `conversation-${Date.now()}`,
      storyId: story.id,
      title,
      createdAt: new Date().toISOString(),
      messages: [createMessage('assistant', `Olá! Eu estou pronta para ajudar com a história “${story.name}”.`)],
    };

    if (backendStatus === 'connected') {
      try {
        const created = await createRemoteConversation({ storyId: story.id, title });
        const full = await getRemoteConversation(created.id);
        conversation = mapRemoteConversation(full);
        setBackendError(null);
      } catch (error) {
        setBackendStatus('error');
        setBackendError(error instanceof Error ? error.message : 'Não foi possível gravar a conversa remotamente.');
      }
    }

    setConversations((current) => [conversation, ...current]);
    setSelectedConversationId(conversation.id);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    const story = activeStory;
    const pendingAttachments = attachments.length ? attachments : [];
    const localUserMessage = createMessage('user', text, pendingAttachments);
    const fallbackReply = `[Modo local] Recebi a sua mensagem sobre “${story?.name ?? 'história'}”. Configure o backend e OPENAI_API_KEY para ativar a resposta real da IA.`;
    const localAssistantMessage = createMessage('assistant', fallbackReply);
    let remoteConversationId = selectedConversationId;

    if (backendStatus === 'connected' && story && !remoteConversationId) {
      try {
        const created = await createRemoteConversation({ storyId: story.id, title: 'Nova conversa' });
        remoteConversationId = created.id;
        setSelectedConversationId(created.id);
      } catch (error) {
        setBackendStatus('error');
        setBackendError(error instanceof Error ? error.message : 'Não foi possível criar a conversa remota.');
      }
    }

    const localConversationId = remoteConversationId ?? `conversation-${Date.now()}`;
    setConversations((current) => {
      const exists = current.some((conversation) => conversation.id === localConversationId);
      if (!exists) {
        return [{
          id: localConversationId,
          storyId: story?.id ?? 'story-1',
          title: buildConversationTitle(text),
          createdAt: new Date().toISOString(),
          messages: [localUserMessage],
        }, ...current];
      }
      return current.map((conversation) => conversation.id === localConversationId
        ? {
            ...conversation,
            title: conversation.title === 'Nova conversa' ? buildConversationTitle(text) : conversation.title,
            messages: [...conversation.messages, localUserMessage],
          }
        : conversation);
    });
    setSelectedConversationId(localConversationId);
    saveMemory(`Mensagem enviada: ${text}`);
    setDraft('');
    setUseAllHistory(false);

    if (backendStatus === 'connected' && remoteConversationId) {
      try {
        const uploadedAttachments = await Promise.all(
          pendingAttachments.map((attachment) => uploadRemoteAttachment(attachment.file)),
        );
        await sendRemoteMessage(remoteConversationId, {
          content: text,
          attachments: uploadedAttachments,
          useAllHistory: useAllHistory || readAllStories,
        });
        const full = await getRemoteConversation(remoteConversationId);
        const remoteConversation = mapRemoteConversation(full);
        setConversations((current) => current.map((conversation) => conversation.id === remoteConversationId ? remoteConversation : conversation));
        setBackendError(null);
        const remoteAssistant = remoteConversation.messages.at(-1);
        setAttachments([]);
        if (voiceEnabled && remoteAssistant) speakText(remoteAssistant.content);
        return;
      } catch (error) {
        setBackendStatus('error');
        setBackendError(error instanceof Error ? error.message : 'A mensagem foi guardada localmente, mas a IA remota falhou.');
      }
    }

    setAttachments([]);
    setConversations((current) => current.map((conversation) => conversation.id === localConversationId
      ? { ...conversation, messages: [...conversation.messages, localAssistantMessage] }
      : conversation));
    if (voiceEnabled) speakText(fallbackReply);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const nextAttachments = files.map((file) => ({
      file,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((current) => [...current, ...nextAttachments]);
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => {
      const attachment = current[index];
      if (attachment?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(attachment.previewUrl);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const copyAllText = async () => {
    const content = (activeConversation?.messages ?? []).map((message) => `${message.role === 'user' ? 'Você' : 'MIAR AI'}: ${message.content}`).join('\n\n');
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1400);
  };

  const toggleProvider = (id: string) => {
    setProviders((current) => current.map((provider) => (provider.id === id ? { ...provider, enabled: !provider.enabled } : provider)));
  };

  const deleteProvider = (id: string) => {
    setProviders((current) => current.filter((provider) => provider.id !== id));
  };

  const updateProvider = (id: string, nextName: string) => {
    setProviders((current) => current.map((provider) => (provider.id === id ? { ...provider, name: nextName } : provider)));
  };

  const deleteMemory = (id: string) => {
    setMemories((current) => current.filter((memory) => memory.id !== id));
  };

  const startDraggingControlBar = (event: PointerEvent) => {
    setDraggingControlBar(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const stopDraggingControlBar = (event: PointerEvent) => {
    setDraggingControlBar(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const moveControlBar = (event: PointerEvent) => {
    if (!draggingControlBar) return;
    const nextX = Math.max(12, Math.min(window.innerWidth - 360, event.clientX - 160));
    const nextY = Math.max(12, Math.min(window.innerHeight - 220, event.clientY - 90));
    setControlBarPosition({ x: nextX, y: nextY });
  };

  const startDraggingHelper = (event: PointerEvent) => {
    setDraggingHelper(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const stopDraggingHelper = (event: PointerEvent) => {
    setDraggingHelper(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const moveHelper = (event: PointerEvent) => {
    if (!draggingHelper) return;
    const nextX = Math.max(12, Math.min(window.innerWidth - 140, event.clientX - 70));
    const nextY = Math.max(12, Math.min(window.innerHeight - 70, event.clientY - 20));
    setHelperPosition({ x: nextX, y: nextY });
  };

  if (authRequired && !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9f2] px-4 text-slate-800">
        <form onSubmit={submitLogin} className="w-full max-w-md rounded-[28px] border border-[#dfe9d9] bg-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Bot size={22} /></div>
            <div>
              <div className="text-lg font-bold">MIAR Pessoal</div>
              <div className="text-sm text-slate-500">Acesso privado de staging</div>
            </div>
          </div>
          <p className="mb-5 text-sm text-slate-600">Informe o seu email e o token de acesso configurado pelo responsável do ambiente.</p>
          <label className="mb-3 block text-sm font-semibold">Email
            <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" required className="mt-1 w-full rounded-xl border border-[#dfe9d9] px-3 py-2 font-normal outline-none focus:border-emerald-500" placeholder="voce@exemplo.com" />
          </label>
          <label className="mb-4 block text-sm font-semibold">Token de acesso
            <input value={authToken} onChange={(event) => setAuthToken(event.target.value)} type="password" required className="mt-1 w-full rounded-xl border border-[#dfe9d9] px-3 py-2 font-normal outline-none focus:border-emerald-500" placeholder="Token privado" />
          </label>
          {authError && <div role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div>}
          <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className={isDark ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-[#f6f9f2] text-slate-800'}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className={`${sidebarCollapsed ? 'w-[78px]' : 'w-full lg:w-[330px]'} border-r ${isDark ? 'border-white/10 bg-slate-900/80' : 'border-[#dfe9d9] bg-[#f7fbf3]'} transition-all`}>
          <div className={`flex items-center justify-between border-b px-4 py-4 ${isDark ? 'border-white/10' : 'border-[#e2ebda]'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                <Bot size={20} />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <div className="text-lg font-semibold">MIAR AI</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>assistente multimodal</div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className={`rounded-full p-2 ${isDark ? 'bg-white/10' : 'bg-white'}`}>
              <Menu size={16} />
            </button>
          </div>

          <div className="p-3">
            <div className={`rounded-2xl border px-3 py-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e2ebda] bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Histórias</div>
                <button type="button" onClick={() => setShowNewStoryModal(true)} className={`rounded-full p-2 ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Plus size={15} />
                </button>
              </div>
              {!sidebarCollapsed && (
                <div className="mt-3 space-y-2">
                  {stories.map((story) => (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => setSelectedStoryId(story.id)}
                      className={`flex w-full items-start gap-2 rounded-2xl border px-3 py-3 text-left ${selectedStoryId === story.id ? (isDark ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50') : (isDark ? 'border-white/10 bg-slate-800/50' : 'border-[#e8efe1] bg-[#fbfdf8]')}`}
                    >
                      <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: story.color }} />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{story.name}</span>
                        <span className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{story.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={`mt-3 rounded-2xl border px-3 py-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e2ebda] bg-white'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 size={15} />
                {!sidebarCollapsed && 'Modelos e APIs'}
              </div>
              {!sidebarCollapsed && (
                <div className="mt-3 space-y-2">
                  {providers.map((provider) => (
                    <div key={provider.id} className={`rounded-2xl border p-2 ${isDark ? 'border-white/10 bg-slate-900/60' : 'border-[#e6eedf] bg-[#fafdf8]'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                          <span className="text-sm font-semibold">{provider.name}</span>
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={provider.enabled} onChange={() => toggleProvider(provider.id)} />
                          ativo
                        </label>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={() => updateProvider(provider.id, provider.name)} className="rounded-full border px-2 py-1 text-xs">editar</button>
                        <button type="button" onClick={() => toggleProvider(provider.id)} className="rounded-full border px-2 py-1 text-xs">desligar</button>
                        <button type="button" onClick={() => deleteProvider(provider.id)} className="rounded-full border px-2 py-1 text-xs">excluir</button>
                      </div>
                      <div className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {provider.freeRequests} gratuitas · {provider.visible ? 'visível' : 'oculta'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`mt-3 rounded-2xl border px-3 py-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e2ebda] bg-white'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers3 size={15} />
                {!sidebarCollapsed && 'Memória infinita'}
              </div>
              {!sidebarCollapsed && (
                <div className="mt-3 space-y-2">
                  {memories.length === 0 ? (
                    <div className={`rounded-2xl border border-dashed p-3 text-xs ${isDark ? 'border-white/10 text-slate-400' : 'border-[#e1e8d9] text-slate-500'}`}>
                      Nenhuma memória registrada. Tudo que você salvar vai ficar aqui para ser lembrado depois.
                    </div>
                  ) : (
                    memories.slice(0, 4).map((memory) => (
                      <div key={memory.id} className={`rounded-2xl border p-2 text-xs ${isDark ? 'border-white/10 bg-slate-900/60' : 'border-[#e7efdf] bg-[#fbfdf8]'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>{memory.content}</div>
                          <button type="button" onClick={() => deleteMemory(memory.id)} className="shrink-0 text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-[#f7fbf2]'}`}>
          <header className={`flex flex-wrap items-center justify-between border-b px-4 py-4 ${isDark ? 'border-white/10 bg-slate-900/70' : 'border-[#e4ecd7] bg-white/80'}`}>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <Sparkles size={16} />
                {activeStory?.name ?? 'História'}
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{activeStory?.description ?? 'Sua base de contexto'}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setIsDark((value) => !value)} className={`rounded-full border p-2 ${isDark ? 'border-white/10 bg-slate-800' : 'border-[#e2ebda] bg-white'}`}>
                {isDark ? <SunMedium size={16} /> : <Moon size={16} />}
              </button>
              <button type="button" onClick={() => setIsLiveMode((value) => !value)} className={`rounded-full px-3 py-2 text-sm font-semibold ${isLiveMode ? (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600')}`}>
                {isLiveMode ? 'Live ON' : 'Live OFF'}
              </button>
              <button type="button" onClick={() => setReadAllStories((value) => !value)} className={`rounded-full px-3 py-2 text-sm font-semibold ${readAllStories ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-50 text-sky-700') : (isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600')}`}>
                {readAllStories ? 'ler todas as histórias' : 'contexto local'}
              </button>
              <span className={`rounded-full px-3 py-2 text-xs font-semibold ${backendStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' : backendStatus === 'error' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {backendStatus === 'connected' ? 'backend conectado' : backendStatus === 'error' ? 'modo local' : 'a ligar…'}
              </span>
            </div>
            {backendError && <div className="mt-2 w-full text-right text-xs text-amber-700">{backendError}</div>}
          </header>

          <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.3fr_0.7fr]">
            <section className={`rounded-[24px] border ${isDark ? 'border-white/10 bg-slate-900/70' : 'border-[#e4ecd7] bg-white'} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Conversas</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>o fluxo fica vivo e sincronizado</div>
                </div>
                <button type="button" onClick={() => createConversation('Nova conversa')} className={`rounded-full px-3 py-2 text-sm font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  nova conversa
                </button>
              </div>

              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className={`rounded-2xl border border-dashed p-4 text-sm ${isDark ? 'border-white/10 text-slate-400' : 'border-[#e4ecd7] text-slate-500'}`}>
                    Ainda não há conversas. Crie uma para começar a experiência.
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${selectedConversationId === conversation.id ? (isDark ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDark ? 'border-white/10 bg-slate-800/50' : 'border-[#e7efe2] bg-[#fbfdf8]')}`}
                    >
                      <div>
                        <div className="text-sm font-semibold">{conversation.title}</div>
                        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{conversation.messages.length} mensagens</div>
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {new Date(conversation.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className={`rounded-[24px] border ${isDark ? 'border-white/10 bg-slate-900/70' : 'border-[#e4ecd7] bg-white'} p-4`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Zap size={15} />
                Painel de funções
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className={`rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e6eedf] bg-[#fbfdf8]'}`}>
                  <div className="font-semibold">Anexos sem limite</div>
                  <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Você pode carregar arquivos e imagens para a IA trabalhar.</div>
                </div>
                <div className={`rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e6eedf] bg-[#fbfdf8]'}`}>
                  <div className="font-semibold">Câmera externa e interna</div>
                  <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ative a câmera e veja o que ela enxerga em tempo real.</div>
                </div>
                <div className={`rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e6eedf] bg-[#fbfdf8]'}`}>
                  <div className="font-semibold">Leitura de voz feminina</div>
                  <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Velocidade de 0x até 3x com pause e stop.</div>
                </div>
              </div>
            </section>
          </div>

          <section className={`mx-4 mb-4 rounded-[28px] border ${isDark ? 'border-white/10 bg-slate-900/70' : 'border-[#e4ecd7] bg-white'} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen size={15} />
                {activeConversation?.title ?? 'Conversa atual'}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={copyAllText} className={`rounded-full border px-3 py-2 text-sm ${isDark ? 'border-white/10 bg-slate-800' : 'border-[#e2ebda] bg-[#fafdf8]'}`}>
                  {copiedAll ? 'copiado' : 'copiar tudo'}
                </button>
                <button type="button" onClick={() => setShowNewStoryModal(true)} className={`rounded-full px-3 py-2 text-sm font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  nova história
                </button>
              </div>
            </div>

            <div className={`rounded-[24px] border p-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e9efe3] bg-[#fbfdf8]'}`}>
              {(activeConversation?.messages ?? []).length === 0 ? (
                <div className={`rounded-2xl border border-dashed p-5 text-sm ${isDark ? 'border-white/10 text-slate-400' : 'border-[#e4ecd7] text-slate-500'}`}>
                  Comece a conversa. A IA vai responder com contexto da história selecionada.
                </div>
              ) : (
                <div className="space-y-3">
                  {(activeConversation?.messages ?? []).map((message) => (
                    <div key={message.id} className={`rounded-2xl p-3 ${message.role === 'user' ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-slate-900/80' : 'bg-white')}`}>
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
                        {message.role === 'user' ? <Send size={12} /> : <Bot size={12} />}
                        <span>{message.role === 'user' ? 'Você' : 'MIAR AI'}</span>
                      </div>
                      <div className="whitespace-pre-line text-sm leading-7">{message.content}</div>
                      {message.attachments?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <span key={`${message.id}-${attachment.name}`} className={`rounded-full px-2 py-1 text-xs ${isDark ? 'bg-slate-700' : 'bg-[#f2f7eb]'}`}>{attachment.name}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
                        <div className={`flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Clock3 size={12} />
                          {formatTimestamp(new Date(message.createdAt))}
                        </div>
                        <div className={`tooltip ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title={formatLongDate(new Date(message.createdAt))}>
                          {new Date(message.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`mt-4 rounded-[24px] border p-3 ${isDark ? 'border-white/10 bg-slate-800/70' : 'border-[#e6eedf] bg-[#fafdf8]'}`}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <AudioLines size={14} />
                  control panel de voz e anexos
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setVoiceEnabled((value) => !value)} className={`rounded-full p-2 ${voiceEnabled ? (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-slate-700' : 'bg-white')}`}>
                    {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  </button>
                  <button type="button" onClick={toggleCamera} className={`rounded-full p-2 ${cameraOpen ? (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-slate-700' : 'bg-white')}`}>
                    {cameraOpen ? <Camera size={15} /> : <CameraOff size={15} />}
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-600'}`}>
                  <Plus size={14} /> anexo
                  <input type="file" multiple className="hidden" onChange={handleFileChange} />
                </label>
                <button type="button" onClick={startListening} className={`rounded-full px-3 py-2 text-sm ${isListening ? 'bg-red-500/20 text-red-400' : (isDark ? 'bg-slate-700 text-slate-100' : 'bg-white text-slate-600')}`}>
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button type="button" onClick={stopListening} className={`rounded-full px-3 py-2 text-sm ${isDark ? 'bg-slate-700 text-slate-100' : 'bg-white text-slate-600'}`}>
                  stop
                </button>
                <button type="button" onClick={pauseSpeech} className={`rounded-full px-3 py-2 text-sm ${isDark ? 'bg-slate-700 text-slate-100' : 'bg-white text-slate-600'}`}>
                  {isSpeaking ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button type="button" onClick={stopSpeech} className={`rounded-full px-3 py-2 text-sm ${isDark ? 'bg-slate-700 text-slate-100' : 'bg-white text-slate-600'}`}>
                  <Square size={14} />
                </button>
                <label className={`rounded-full px-3 py-2 text-sm ${isDark ? 'bg-slate-700 text-slate-100' : 'bg-white text-slate-600'}`}>
                  velocidade {voiceRate.toFixed(1)}x
                  <input type="range" min="0" max="3" step="0.25" value={voiceRate} onChange={(event) => setVoiceRate(Number(event.target.value))} className="ml-2" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`} className={`flex items-center gap-2 rounded-2xl px-2 py-1 text-xs ${isDark ? 'bg-slate-700' : 'bg-[#f2f7eb]'}`}>
                    {attachment.previewUrl ? <img src={attachment.previewUrl} alt="Pré-visualização do anexo" className="h-8 w-8 rounded-lg object-cover" /> : null}
                    <span className="max-w-[180px] truncate">{attachment.name}</span>
                    <button type="button" onClick={() => removeAttachment(index)} aria-label={`Remover ${attachment.name}`} className="rounded-full p-1 hover:bg-black/10"><X size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Digite sua mensagem..."
                  className={`min-h-[56px] flex-1 resize-none rounded-[18px] border px-3 py-3 text-sm outline-none ${isDark ? 'border-white/10 bg-slate-900 text-slate-100' : 'border-[#e3ebdc] bg-white text-slate-700'}`}
                  rows={1}
                />
                <button type="button" onClick={sendMessage} className={`rounded-[18px] p-3 ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Send size={16} />
                </button>
              </div>
              {cameraOpen && cameraStream ? (
                <div className="mt-3 rounded-2xl border border-emerald-400/30 p-2">
                  <video ref={videoRef} className="h-40 w-full rounded-2xl object-cover" muted playsInline />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={captureCameraFrame} className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">capturar imagem</button>
                    <button type="button" onClick={() => setCameraOpen(false)} className={`rounded-full px-3 py-2 text-xs ${isDark ? 'bg-slate-700' : 'bg-[#f2f7eb]'}`}>fechar câmera</button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      <button
        type="button"
        onPointerDown={startDraggingHelper}
        onPointerMove={moveHelper}
        onPointerUp={stopDraggingHelper}
        onPointerLeave={stopDraggingHelper}
        onClick={() => {
          setUseAllHistory(true);
          setReadAllStories(true);
        }}
        className={`fixed z-40 flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg ${isDark ? 'border-white/10 bg-slate-800 text-slate-100' : 'border-[#e0ebd8] bg-white text-slate-700'}`}
        style={{ left: helperPosition.x, top: helperPosition.y }}
      >
        <Grip size={15} />
        <span className="text-sm font-semibold">contexto total</span>
      </button>

      <div
        onPointerDown={startDraggingControlBar}
        onPointerMove={moveControlBar}
        onPointerUp={stopDraggingControlBar}
        onPointerLeave={stopDraggingControlBar}
        className={`fixed z-30 rounded-[24px] border p-3 shadow-xl ${isDark ? 'border-white/10 bg-slate-900/95 text-slate-100' : 'border-[#dfe9d9] bg-white/95 text-slate-700'}`}
        style={{ left: controlBarPosition.x, top: controlBarPosition.y }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Grip size={14} /> controles arrastáveis
        </div>
      </div>

      {showNewStoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`w-full max-w-md rounded-[24px] border p-4 ${isDark ? 'border-white/10 bg-slate-900 text-slate-100' : 'border-[#e4ecd7] bg-white text-slate-800'}`}>
            <div className="text-lg font-semibold">Criar uma nova história</div>
            <div className="mt-3 space-y-3">
              <input value={newStoryName} onChange={(event) => setNewStoryName(event.target.value)} placeholder="Nome da história" className={`w-full rounded-2xl border px-3 py-2 ${isDark ? 'border-white/10 bg-slate-800' : 'border-[#e2ebda] bg-[#fbfdf8]'}`} />
              <textarea value={newStoryDescription} onChange={(event) => setNewStoryDescription(event.target.value)} placeholder="Conte o contexto para a IA" className={`min-h-[90px] w-full rounded-2xl border px-3 py-2 ${isDark ? 'border-white/10 bg-slate-800' : 'border-[#e2ebda] bg-[#fbfdf8]'}`} />
              <input type="color" value={newStoryColor} onChange={(event) => setNewStoryColor(event.target.value)} className="h-10 w-full rounded-2xl border p-1" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newStoryReadAll} onChange={(event) => setNewStoryReadAll(event.target.checked)} />
                Querer que a IA leia todas as histórias antes de responder
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewStoryModal(false)} className={`rounded-full px-3 py-2 ${isDark ? 'bg-slate-800' : 'bg-[#f2f7eb]'}`}>cancelar</button>
              <button type="button" onClick={createStory} className="rounded-full bg-emerald-600 px-3 py-2 text-white">criar história</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
