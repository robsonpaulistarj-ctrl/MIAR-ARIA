import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CircleHelp,
  Clapperboard,
  Download,
  FileVideo,
  Info,
  Laptop,
  Maximize2,
  Mic,
  Minimize2,
  MonitorUp,
  Radio,
  RotateCcw,
  ShieldAlert,
  Square,
  Sparkles,
  Timer,
  Video,
  X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type SourceMode = 'none' | 'screen' | 'camera' | 'both';
type RecordingStatus = 'idle' | 'recording' | 'finished';

type EcosystemModule = {
  key: string;
  name: string;
  description: string;
  status: string;
  accent: string;
  detail: string;
  actionLabel: string;
};

const ecosystemModules: EcosystemModule[] = [
  {
    key: 'edita',
    name: 'MIAR EDITA',
    description: 'Estúdio vivo para gravação, edição e publicação.',
    status: 'ativo',
    accent: 'from-[#d3f055] via-[#8aa12e] to-[#2d2939]',
    detail: 'A EDITA continua como o centro do ecossistema: gravação simultânea, edição, roteiro e publicação com contexto real, sem depender da camada pessoal.',
    actionLabel: 'abrir estúdio',
  },
  {
    key: 'pessoal',
    name: 'MIAR Pessoal',
    description: 'Assistente pessoal de rotina, decisões e memória cotidiana.',
    status: 'ativo',
    accent: 'from-[#f2c76b] via-[#d37b65] to-[#2d2939]',
    detail: 'O módulo pessoal é separado da EDITA: ele organiza tarefas, decisões e contexto do dia a dia, preservando memória viva para o usuário.',
    actionLabel: 'abrir rotina',
  },
  {
    key: 'nuvem',
    name: 'Nuvem MIAR',
    description: 'Sincronização, backup e recuperação segura dos arquivos.',
    status: 'pronto',
    accent: 'from-[#91c7ff] via-[#4c7dff] to-[#2d2939]',
    detail: 'Central de sincronização segura para manter o contexto, os arquivos e os ambientes conectados em qualquer dispositivo.',
    actionLabel: 'ver nuvem',
  },
  {
    key: 'guarda',
    name: 'Guardiã',
    description: 'Proteção contextual e preservação de registros em risco.',
    status: 'novo',
    accent: 'from-[#6fe7b5] via-[#3f8f4f] to-[#2d2939]',
    detail: 'Módulo dedicado a registrar eventos, preservar contexto, gerar linha do tempo e proteger o usuário em situações críticas.',
    actionLabel: 'ativar proteção',
  },
  {
    key: 'voz',
    name: 'Voz & IA',
    description: 'Comandos por voz, resumos e assistência contínua.',
    status: 'pronto',
    accent: 'from-[#b6c9ff] via-[#6d7bf4] to-[#2d2939]',
    detail: 'A camada de voz permite interações naturais, comandos rápidos e respostas assistidas sem interromper o fluxo.',
    actionLabel: 'ativar voz',
  },
  {
    key: 'fluxo',
    name: 'Fluxo Diário',
    description: 'Planejamento de rotina, metas e execução por contexto.',
    status: 'em expansão',
    accent: 'from-[#f4e7a1] via-[#c3aa41] to-[#2d2939]',
    detail: 'Organiza o dia, conecta ações e transforma decisões em passos claros para o usuário seguir com menos fricção.',
    actionLabel: 'ver fluxo',
  },
  {
    key: 'memoria',
    name: 'Memória Viva',
    description: 'Contexto contínuo e recuperação inteligente da informação.',
    status: 'ativo',
    accent: 'from-[#f4c9d6] via-[#c77489] to-[#2d2939]',
    detail: 'A memória viva guarda sinais, decisões e aprendizados para que o sistema continue útil ao longo do tempo.',
    actionLabel: 'abrir memória',
  },
  {
    key: 'operacoes',
    name: 'Operações',
    description: 'Painel central de execução, rastreamento e status.',
    status: 'pronto',
    accent: 'from-[#cbc5ff] via-[#7c4dff] to-[#2d2939]',
    detail: 'Painel operacional para acompanhar eventos, processos e resposta em tempo real sem sair da experiência principal.',
    actionLabel: 'abrir painel',
  },
  {
    key: 'conteudo',
    name: 'Conteúdo',
    description: 'Criação de peças, campanhas, roteiros e conteúdo pronto para publicação.',
    status: 'ativo',
    accent: 'from-[#ffe0b7] via-[#eb745f] to-[#2d2939]',
    detail: 'A camada de conteúdo transforma ideias em peças preparadas para mídia, redes sociais e apresentação.',
    actionLabel: 'abrir conteúdo',
  },
  {
    key: 'seguranca',
    name: 'Segurança',
    description: 'Alertas, rastreamento e respostas discretas em situações críticas.',
    status: 'em teste',
    accent: 'from-[#d9f4ff] via-[#4cc1d9] to-[#2d2939]',
    detail: 'A camada de segurança atua como um ambiente confiável de proteção, preservação de contexto e resposta objetiva.',
    actionLabel: 'testar módulo',
  },
];

const scriptScenes = [
  {
    number: '01',
    label: 'ABERTURA',
    duration: '00:08',
    narration:
      'Toda boa ideia começa com uma pergunta. Hoje, vamos transformar uma tela vazia em algo que vale a pena compartilhar.',
  },
  {
    number: '02',
    label: 'CONTEXTO',
    duration: '00:18',
    narration:
      'Apresente o ponto de partida sem pressa. Mostre o problema, o detalhe que passou despercebido e por que ele importa agora.',
  },
  {
    number: '03',
    label: 'DEMONSTRAÇÃO',
    duration: '00:32',
    narration:
      'Agora, acompanhe o processo. Uma ação por vez, com clareza. A pessoa do outro lado deve conseguir seguir sem precisar pausar.',
  },
  {
    number: '04',
    label: 'FECHAMENTO',
    duration: '00:12',
    narration:
      'É isso. Uma mudança pequena, um resultado visível. Obrigado por assistir — nos vemos na próxima ideia.',
  },
];

const aiSuggestions = [
  'Resuma este take em 3 bullets.',
  'Traduza para inglês com tom profissional.',
  'Crie uma versão curta para rede social.',
  'Sugira cortes e transições para a edição.',
];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getSourceMode(screenActive: boolean, cameraActive: boolean): SourceMode {
  if (screenActive && cameraActive) return 'both';
  if (screenActive) return 'screen';
  if (cameraActive) return 'camera';
  return 'none';
}

function Home() {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedSize, setRecordedSize] = useState(0);
  const [recordedExtension, setRecordedExtension] = useState<'webm' | 'mp4'>('webm');
  const [error, setError] = useState<string | null>(null);
  const [isMonitorFullscreen, setIsMonitorFullscreen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<EcosystemModule>(ecosystemModules[0]);
  const [aiPrompt, setAiPrompt] = useState(aiSuggestions[0]);
  const [aiResponse, setAiResponse] = useState('A MIAR IA está pronta para revisar o roteiro, traduzir o conteúdo, criar versões para redes e sugerir cortes em tempo real.');

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const drawFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const sourceMode = getSourceMode(Boolean(screenStream), Boolean(cameraStream));
  const isRecording = recordingStatus === 'recording';

  const handleAiAction = useCallback((prompt: string) => {
    setAiPrompt(prompt);
    setAiResponse(`MIAR IA: ${prompt} → resposta pronta para edição em tempo real.`);
  }, []);

  useEffect(() => {
    screenStreamRef.current = screenStream;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
      if (screenStream) void screenVideoRef.current.play().catch(() => undefined);
    }
  }, [screenStream]);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
      if (cameraStream) void cameraVideoRef.current.play().catch(() => undefined);
    }
  }, [cameraStream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMonitorFullscreen(document.fullscreenElement === monitorRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (drawFrameRef.current) window.cancelAnimationFrame(drawFrameRef.current);
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, []);

  const toggleMonitorFullscreen = useCallback(async () => {
    const monitor = monitorRef.current;
    if (!monitor) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (monitor.requestFullscreen) {
        await monitor.requestFullscreen();
      } else {
        setError('A tela inteira não está disponível neste navegador.');
      }
    } catch {
      setError('Não foi possível abrir o monitor em tela inteira. Tente novamente pelo botão do navegador.');
    }
  }, []);

  const stopDrawLoop = useCallback(() => {
    if (drawFrameRef.current) {
      window.cancelAnimationFrame(drawFrameRef.current);
      drawFrameRef.current = null;
    }
    canvasRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const handleScreenEnded = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      stopRecording();
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setError('O compartilhamento de tela terminou. Escolha uma tela ou janela novamente para continuar.');
  }, [stopRecording]);

  const enableScreen = useCallback(async () => {
    if (isRecording) return;
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Seu navegador não oferece captura de tela. Use o Chrome no Android ou um navegador desktop atualizado.');
      return;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        stream.getTracks().forEach((track) => track.stop());
        setError('Nenhuma fonte de tela foi selecionada.');
        return;
      }
      videoTrack.addEventListener('ended', handleScreenEnded, { once: true });
      setScreenStream(stream);
    } catch (captureError) {
      const name = captureError instanceof DOMException ? captureError.name : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setError('Permissão de tela recusada ou seleção cancelada. O navegador sempre mostra o seletor obrigatório.');
      } else {
        setError('Não foi possível iniciar a captura de tela. Verifique as permissões do navegador.');
      }
    }
  }, [handleScreenEnded, isRecording, screenStream]);

  const enableCamera = useCallback(async () => {
    if (isRecording) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Seu navegador não oferece câmera e microfone. Use uma versão atualizada do Chrome.');
      return;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      setCameraStream(stream);
    } catch (captureError) {
      const name = captureError instanceof DOMException ? captureError.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Permissão de câmera ou microfone recusada. Libere o acesso nas configurações do navegador e tente novamente.');
      } else {
        setError('Não foi possível acessar a câmera. Verifique se ela não está sendo usada por outro aplicativo.');
      }
    }
  }, [cameraStream, isRecording]);

  const buildRecordingStream = useCallback(() => {
    const screen = screenStreamRef.current;
    const camera = cameraStreamRef.current;
    if (!screen && !camera) return null;
    if (screen && camera) {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvasRef.current = canvas;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const screenVideo = screenVideoRef.current;
      const cameraVideo = cameraVideoRef.current;
      const draw = () => {
        context.fillStyle = '#171526';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (screenVideo && screenVideo.readyState >= 2) {
          const sourceWidth = screenVideo.videoWidth || 1280;
          const sourceHeight = screenVideo.videoHeight || 720;
          const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
          const width = sourceWidth * scale;
          const height = sourceHeight * scale;
          context.drawImage(screenVideo, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        }
        if (cameraVideo && cameraVideo.readyState >= 2) {
          const insetWidth = 290;
          const insetHeight = 174;
          const insetX = canvas.width - insetWidth - 32;
          const insetY = canvas.height - insetHeight - 32;
          context.save();
          context.beginPath();
          const radius = 24;
          context.roundRect(insetX, insetY, insetWidth, insetHeight, radius);
          context.clip();
          const sourceWidth = cameraVideo.videoWidth || insetWidth;
          const sourceHeight = cameraVideo.videoHeight || insetHeight;
          const scale = Math.max(insetWidth / sourceWidth, insetHeight / sourceHeight);
          const width = sourceWidth * scale;
          const height = sourceHeight * scale;
          context.drawImage(cameraVideo, insetX + (insetWidth - width) / 2, insetY + (insetHeight - height) / 2, width, height);
          context.restore();
          context.strokeStyle = '#d3f055';
          context.lineWidth = 4;
          context.beginPath();
          context.roundRect(insetX, insetY, insetWidth, insetHeight, radius);
          context.stroke();
        }
        drawFrameRef.current = window.requestAnimationFrame(draw);
      };
      draw();
      const composed = canvas.captureStream(30);
      const audioSources = [screen, camera].filter((source) => source.getAudioTracks().length > 0);
      if (audioSources.length > 0 && typeof AudioContext !== 'undefined') {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        audioSources.forEach((source) => {
          audioContext.createMediaStreamSource(source).connect(destination);
        });
        audioContextRef.current = audioContext;
        destination.stream.getAudioTracks().forEach((track) => composed.addTrack(track));
      }
      return composed;
    }
    return screen ?? camera;
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    const stream = buildRecordingStream();
    if (!stream || stream.getTracks().length === 0) {
      setError('Adicione uma fonte antes de gravar: tela, câmera ou as duas.');
      return;
    }
    if (!window.MediaRecorder) {
      setError('Seu navegador não suporta gravação de vídeo. Use o Chrome atualizado.');
      stopDrawLoop();
      return;
    }
    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      setError('Nenhum formato de vídeo compatível foi encontrado neste navegador.');
      stopDrawLoop();
      return;
    }
    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('A gravação encontrou um erro inesperado. Tente iniciar novamente.');
        setRecordingStatus('idle');
        stopDrawLoop();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setError('O arquivo ficou vazio. Tente gravar por alguns segundos antes de parar.');
        } else {
          if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
          const url = URL.createObjectURL(blob);
          recordedUrlRef.current = url;
          setRecordedUrl(url);
          setRecordedSize(blob.size);
          setRecordedExtension(mimeType.startsWith('video/mp4') ? 'mp4' : 'webm');
          setRecordingStatus('finished');
        }
        const sourceTracks = [
          ...(screenStreamRef.current?.getTracks() ?? []),
          ...(cameraStreamRef.current?.getTracks() ?? []),
        ];
        stream.getTracks().forEach((track) => {
          if (!sourceTracks.includes(track)) track.stop();
        });
        recorderRef.current = null;
        void audioContextRef.current?.close();
        audioContextRef.current = null;
        stopDrawLoop();
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
      recorder.start(250);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecordingStatus('recording');
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch {
      setError('Não foi possível iniciar a gravação deste dispositivo.');
      stopDrawLoop();
    }
  }, [buildRecordingStream, stopDrawLoop]);

  const resetRecording = useCallback(() => {
    if (recordingStatus === 'recording') stopRecording();
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    setRecordedUrl(null);
    setRecordedSize(0);
    setRecordedExtension('webm');
    setElapsed(0);
    setRecordingStatus('idle');
    setError(null);
  }, [recordingStatus, stopRecording]);

  const previewUrl = recordedUrl;
  useEffect(() => {
    if (previewVideoRef.current && previewUrl) {
      previewVideoRef.current.load();
    }
  }, [previewUrl]);

  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="studio-grain flex h-full w-full flex-col overflow-hidden bg-[#ece8dc] text-[#292334]">
      <header className="border-b border-[#d7d1c4] bg-[#f4f0e7]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#2d2939] text-[#d3f055] shadow-[4px_4px_0_#c7c0b0]">
              <Clapperboard size={19} strokeWidth={2.2} />
            </div>
            <div>
              <div data-testid="text-brand" className="text-[15px] font-bold tracking-[0.16em] text-[#2d2939]">MIAR <span className="text-[#eb745f]">EDITA</span></div>
              <div className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-[#77716a] sm:block">sala de gravação</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[#d8d1c5] bg-[#eee9df] px-3 py-1.5 text-[11px] font-medium text-[#67616a] sm:flex">
              <Sparkles size={13} className="text-[#849f2a]" />
              editora ao vivo e simultânea
            </div>
            <div data-testid="status-workspace" className="flex items-center gap-2 rounded-full border border-[#d8d1c5] bg-[#eee9df] px-3 py-1.5 text-[11px] font-medium">
              <span className={`h-2 w-2 rounded-full ${isRecording ? 'animate-pulse-record bg-[#e75f4e]' : 'bg-[#8fae32]'}`} />
              {isRecording ? 'gravando agora' : recordingStatus === 'finished' ? 'arquivo pronto' : 'sala pronta'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100%-73px)] w-full max-w-[1440px] flex-1 flex-col overflow-hidden px-5 pb-3 pt-4 lg:px-10 lg:pt-4">
        <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-end">
          <div className="animate-rise-in">
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#8d846f]">
              <span className="h-px w-6 bg-[#d37b65]" /> projeto sem título / take 01
            </p>
            <h1 className="max-w-[820px] text-2xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#2d2939] sm:text-4xl">
              não é um chat.<br /><span className="text-[#7d9827]">é uma diretora de edição ao vivo.</span>
            </h1>
          </div>
          <div className="animate-rise-in animate-rise-in-delay-1 max-w-[360px] text-sm leading-5 text-[#736c69]">
            Ela edita fotos, vídeos, roteiros, códigos e transcrições em tempo real, traduz e reescreve em outros idiomas, e pode preparar conteúdo para publicação nas redes sociais.
          </div>
        </div>

        <section className="animate-rise-in animate-rise-in-delay-2 mb-3 rounded-3xl border border-[#d7d0c3] bg-[#f7f3ea] p-4 shadow-[0_14px_36px_rgba(45,41,57,0.08)]">
          <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-[#d7d0c3] bg-[#f7f2e8] p-5 text-[#2d2939]">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d7d0c3] bg-[#fffdfa] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d37b65]">
                <Sparkles size={12} /> MIAR Pessoal · IA pessoal
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">A IA pessoal fica na frente como assistente da rotina.</h2>
              <p className="mt-3 text-sm leading-7 text-[#655f58]">Ela organiza memória, contexto, preferências e decisões do usuário, sem depender do fluxo de produção.</p>

              <div className="mt-4 rounded-2xl border border-[#e4ded2] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a806f]">prompt da IA pessoal</span>
                  <span className="rounded-full bg-[#2d2939] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6f05f]">ativo</span>
                </div>
                <input
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  className="w-full rounded-xl border border-[#d7d0c3] bg-[#fdfaf4] px-3 py-2.5 text-sm text-[#2d2939] outline-none ring-0"
                  placeholder="Digite uma instrução para a IA pessoal"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAiAction(suggestion)}
                      className="rounded-full border border-[#d7d0c3] bg-[#fdfaf4] px-2.5 py-1.5 text-[11px] font-medium text-[#6a625d] transition hover:border-[#2d2939] hover:text-[#2d2939]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleAiAction(aiPrompt)}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#2d2939] px-4 py-2.5 text-sm font-semibold text-[#f7f2e8] transition hover:bg-[#3b354a]"
                >
                  Enviar para a IA pessoal
                </button>
                <div className="mt-4 rounded-2xl border border-[#e4ded2] bg-[#fbf7ea] p-3 text-sm leading-7 text-[#5f584f]">
                  {aiResponse}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#d7d0c3] bg-[#2d2939] p-5 text-[#f7f2e8]">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d6f05f]">
                <Clapperboard size={12} /> MIAR EDITA · módulo do ecossistema
              </div>
              <h3 className="text-2xl font-semibold tracking-[-0.02em]">A EDITA funciona como um módulo dedicado da suíte.</h3>
              <p className="mt-3 text-sm leading-7 text-[#ddd5c3]">Ela recebe contexto da IA pessoal, mas mantém sua própria função: gravação, edição, roteiro e publicação.</p>

              <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="flex items-center justify-between rounded-xl bg-[#f7f2e8]/10 px-3 py-2.5">
                  <span className="text-sm font-semibold">Roteiro</span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#d6f05f]">organização</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#f7f2e8]/10 px-3 py-2.5">
                  <span className="text-sm font-semibold">Gravação</span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#d6f05f]">fluxo</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#f7f2e8]/10 px-3 py-2.5">
                  <span className="text-sm font-semibold">Publicação</span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#d6f05f]">entrega</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid flex-1 min-h-0 items-start gap-3 lg:grid-cols-[minmax(260px,0.72fr)_minmax(460px,1.55fr)]">
          <section className="animate-rise-in animate-rise-in-delay-1 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#d7d0c3] bg-[#f7f3ea] shadow-[0_8px_28px_rgba(51,42,42,0.05)]">
            <div className="flex items-center justify-between border-b border-[#ded8cc] px-4 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a8d76]">roteiro de gravação</p>
                <h2 data-testid="text-script-title" className="mt-1 text-lg font-semibold tracking-[-0.02em]">A primeira pergunta</h2>
              </div>
              <button type="button" data-testid="button-script-help" aria-label="Sobre o roteiro" className="rounded-full p-2 text-[#8c8377] transition hover:bg-[#e9e3d6] hover:text-[#2d2939]">
                <CircleHelp size={17} />
              </button>
            </div>
            <div className="border-b border-[#ded8cc] bg-[#eeeadf] px-4 py-2.5">
              <div className="flex items-center justify-between text-[11px] text-[#6c675f]">
                <span className="flex items-center gap-2"><Timer size={14} /> duração estimada</span>
                <span className="font-mono font-medium text-[#2d2939]">01:10</span>
              </div>
            </div>
            <div className="divide-y divide-[#e4ded2]">
              {scriptScenes.map((scene, index) => (
                <article data-testid={`card-script-scene-${scene.number}`} key={scene.number} className={`group px-4 py-3 transition ${index === 0 ? 'bg-[#fbf8f0]' : 'hover:bg-[#fbf8f0]'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-xs ${index === 0 ? 'text-[#d16d59]' : 'text-[#a79e90]'}`}>{scene.number}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#787067]">{scene.label}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#9b9184]">{scene.duration}</span>
                  </div>
                  <p className="text-[13px] leading-[1.65] text-[#4c4650]">{scene.narration}</p>
                </article>
              ))}
            </div>
            <div className="border-t border-[#ded8cc] px-4 py-3">
              <div className="flex items-start gap-2.5 text-[11px] leading-5 text-[#777066]">
                <Info size={15} className="mt-0.5 shrink-0 text-[#8aa12e]" />
                O roteiro fica aqui enquanto você grava. Não precisa trocar de janela.
              </div>
            </div>
          </section>

          <section className="animate-rise-in animate-rise-in-delay-2 flex min-h-0 flex-col min-w-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#2d2939]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#77716a]">monitor de saída</span>
              </div>
              {sourceMode !== 'none' && (
                <span data-testid="text-source-mode" className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#899d35]">
                  {sourceMode === 'both' ? 'tela + câmera' : sourceMode === 'screen' ? 'tela ativa' : 'câmera ativa'}
                </span>
              )}
            </div>
            <div
              ref={monitorRef}
              data-testid="preview-monitor"
              className={`preview-scan relative aspect-video flex-1 overflow-hidden rounded-2xl border border-[#494352] bg-[#282535] shadow-[0_18px_42px_rgba(45,41,57,0.18)] ${isRecording ? 'is-recording' : ''}`}
            >
              <video ref={screenVideoRef} muted playsInline className={`absolute inset-0 h-full w-full object-cover ${screenStream ? 'opacity-100' : 'opacity-0'}`} />
              <video ref={cameraVideoRef} muted playsInline className={`absolute bottom-5 right-5 z-10 aspect-video w-[27%] rounded-xl border-2 border-[#d3f055] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${cameraStream ? 'opacity-100' : 'opacity-0'}`} />
              <button
                type="button"
                data-testid="button-toggle-monitor-fullscreen"
                onClick={toggleMonitorFullscreen}
                aria-label={isMonitorFullscreen ? 'Sair da tela inteira' : 'Abrir monitor em tela inteira'}
                title={isMonitorFullscreen ? 'Sair da tela inteira' : 'Abrir monitor em tela inteira'}
                className="absolute right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#25222f]/80 text-[#f1eddf] shadow-lg backdrop-blur-sm transition hover:bg-[#3b354a] hover:text-[#d3f055]"
              >
                {isMonitorFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              {sourceMode === 'none' && !previewUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-[#f1eddf]">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6b6673] bg-[#353143] text-[#d3f055]">
                    <Video size={24} strokeWidth={1.6} />
                  </div>
                  <p className="text-sm font-medium">seu quadro começa aqui</p>
                  <p className="mt-1 max-w-[280px] text-xs leading-5 text-[#aaa4ad]">Ative uma fonte para visualizar o que será gravado.</p>
                </div>
              )}
              {sourceMode === 'screen' && (
                <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md bg-[#25222f]/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#d9d2c8]">tela</div>
              )}
              {sourceMode === 'camera' && (
                <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md bg-[#25222f]/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#d9d2c8]">câmera</div>
              )}
              {isRecording && (
                <div data-testid="status-recording-overlay" className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md bg-[#e55e4d] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#fff4e8] shadow-lg">
                  <span className="h-1.5 w-1.5 animate-pulse-record rounded-full bg-[#fff4e8]" />
                  REC {formatTime(elapsed)}
                </div>
              )}
              {previewUrl && (
                <video ref={previewVideoRef} controls playsInline className="absolute inset-0 z-30 h-full w-full bg-[#282535] object-contain">
                  <source src={previewUrl} />
                </video>
              )}
              {!isRecording && sourceMode !== 'none' && !previewUrl && (
                <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-md bg-[#2d2939]/75 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-[#dad4c9]">
                  pré-visualização ao vivo
                </div>
              )}
            </div>

            {error && (
              <div data-testid="status-recording-error" role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-[#e3b1a5] bg-[#fff1ed] px-4 py-3 text-[12px] leading-5 text-[#9c4034]">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button type="button" data-testid="button-dismiss-error" aria-label="Fechar aviso" onClick={() => setError(null)} className="shrink-0 rounded p-0.5 hover:bg-[#f7d9d2]"><X size={15} /></button>
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                data-testid="button-toggle-screen"
                onClick={enableScreen}
                disabled={isRecording}
                className={`group flex min-h-[50px] items-center gap-3 rounded-xl border px-3 text-left transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60 ${screenStream ? 'border-[#96ad3b] bg-[#e5edbe]' : 'border-[#cfc8bb] bg-[#f7f3ea] hover:border-[#aebc69] hover:bg-[#f9f6ed]'}`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${screenStream ? 'bg-[#2d2939] text-[#d3f055]' : 'bg-[#e8e2d5] text-[#57505c]'}`}><MonitorUp size={18} /></span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{screenStream ? 'Desligar tela' : 'Gravar tela'}</span>
                  <span className="mt-0.5 block text-[10px] text-[#78716b]">{screenStream ? 'fonte selecionada' : 'selecione uma janela ou tela'}</span>
                </span>
                {screenStream && <Check size={17} className="text-[#728c20]" />}
              </button>
              <button
                type="button"
                data-testid="button-toggle-camera"
                onClick={enableCamera}
                disabled={isRecording}
                className={`group flex min-h-[50px] items-center gap-3 rounded-xl border px-3 text-left transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60 ${cameraStream ? 'border-[#96ad3b] bg-[#e5edbe]' : 'border-[#cfc8bb] bg-[#f7f3ea] hover:border-[#aebc69] hover:bg-[#f9f6ed]'}`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${cameraStream ? 'bg-[#2d2939] text-[#d3f055]' : 'bg-[#e8e2d5] text-[#57505c]'}`}><Camera size={18} /></span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{cameraStream ? 'Desligar câmera' : 'Ligar câmera'}</span>
                  <span className="mt-0.5 block text-[10px] text-[#78716b]">{cameraStream ? 'vídeo + microfone ativos' : 'opcional, com microfone'}</span>
                </span>
                {cameraStream && <Check size={17} className="text-[#728c20]" />}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#d1c9bb] bg-[#e4dfd3] p-2.5 sm:flex-row sm:items-center">
              {recordingStatus === 'finished' ? (
                <>
                  <div className="flex flex-1 items-center gap-3 px-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d3f055] text-[#2d2939]"><FileVideo size={17} /></div>
                    <div>
                      <p data-testid="text-recording-ready" className="text-sm font-semibold">gravação pronta</p>
                      <p data-testid="text-recording-size" className="font-mono text-[10px] text-[#777066]">{formatSize(recordedSize)} · {formatTime(elapsed)}</p>
                    </div>
                  </div>
                  <a href={recordedUrl ?? '#'} download={`miar-edita-take-01.${recordedExtension}`} data-testid="button-download-recording" className="flex min-h-[47px] items-center justify-center gap-2 rounded-xl bg-[#2d2939] px-5 text-sm font-semibold text-[#f5f0e4] transition hover:bg-[#3b354a]">
                    <Download size={17} /> Baixar vídeo
                  </a>
                  <button type="button" data-testid="button-new-recording" onClick={resetRecording} className="flex min-h-[47px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#605966] transition hover:bg-[#d6d0c4]">
                    <RotateCcw size={15} /> Novo take
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-1 items-center gap-3 px-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isRecording ? 'bg-[#e75f4e] text-[#fff5ed]' : 'bg-[#d7d0c2] text-[#5a5360]'}`}><Radio size={17} /></div>
                    <div>
                      <p data-testid="text-recording-status" className="text-sm font-semibold">{isRecording ? 'gravando seu take' : 'pronto para gravar'}</p>
                      <p className="font-mono text-[10px] text-[#777066]">{isRecording ? `${formatTime(elapsed)} decorridos` : sourceMode === 'none' ? 'adicione uma fonte acima' : `${sourceMode === 'both' ? 'tela e câmera' : sourceMode === 'screen' ? 'tela' : 'câmera'} selecionada`}</p>
                    </div>
                  </div>
                  {isRecording ? (
                    <button type="button" data-testid="button-stop-recording" onClick={stopRecording} className="flex min-h-[47px] items-center justify-center gap-2 rounded-xl bg-[#e75f4e] px-7 text-sm font-semibold text-[#fff4e8] transition hover:bg-[#cf5142]">
                      <Square size={15} fill="currentColor" /> Parar gravação
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="button-start-recording"
                      onClick={startRecording}
                      disabled={sourceMode === 'none'}
                      title={sourceMode === 'none' ? 'Adicione uma fonte antes de gravar' : 'Iniciar gravação'}
                      className="flex min-h-[47px] items-center justify-center gap-2 rounded-xl bg-[#2d2939] px-7 text-sm font-semibold text-[#f5f0e4] shadow-[0_4px_0_#171522] transition hover:-translate-y-0.5 hover:bg-[#3b354a] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:bg-[#b5afa5] disabled:text-[#eeeae2] disabled:shadow-none disabled:hover:translate-y-0"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-[#e75f4e]" /> Iniciar gravação
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        <section className="animate-rise-in animate-rise-in-delay-3 mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-[#d7d0c3] bg-[#f4f0e7] px-5 py-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a806f]"><ShieldAlert size={14} className="text-[#d16d59]" /> compromisso editorial</div>
            <div className="grid gap-3 text-[11px] leading-5 text-[#6f6866] sm:grid-cols-2">
              <p><strong className="text-[#443d4a]">Uso responsável.</strong> A MIAR AI EDITA ajuda a organizar, aprimorar e apresentar conteúdo com autenticidade e integridade.</p>
              <p><strong className="text-[#443d4a]">Sem falsificação.</strong> Ela não cria nem falsifica documentos; sua função é editar, estruturar e dar clareza ao material.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#d7d0c3] bg-[#f4f0e7] px-5 py-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a806f]"><Laptop size={14} className="text-[#7d9827]" /> capacidades principais</div>
            <ul className="space-y-2 text-[12px] leading-5 text-[#6f6866]">
              <li>• Edição ao vivo e simultânea de tela, vídeo, imagem e áudio.</li>
              <li>• Transcrição de voz para texto e texto para voz, com ajuste de idioma.</li>
              <li>• Armazenamento em nuvem com busca e recuperação de arquivos sob demanda.</li>
              <li>• Sugestões de edição para filmes, propagandas e peças para redes sociais.</li>
            </ul>
          </div>
        </section>

        <section className="animate-rise-in animate-rise-in-delay-3 mt-6 rounded-3xl border border-[#d7d0c3] bg-[#2d2939] p-6 text-[#f7f2e8]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d6f05f]">modo produção gastronômica</p>
              <h3 className="mt-2 text-2xl font-semibold">Enquanto você mostra o sistema, a editora acompanha estoque, catálogo e cardápio.</h3>
            </div>
            <div className="max-w-[360px] text-sm leading-6 text-[#d9d0c2]">
              O foco não é só gravar. É mostrar o produto funcionando, com organização real, sugestões de conteúdo e uma camada de publicação pronta para aprovação.
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ['Estoque', 'Acompanha entradas, saídas e o que precisa ser destacado.'],
              ['Catálogo', 'Gera descrições e estrutura de apresentação para os produtos.'],
              ['Cardápio', 'Organiza variações prontas para virar conteúdo de campanha.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[#d7cfbf]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="animate-rise-in animate-rise-in-delay-3 mt-6 rounded-3xl border border-[#d7d0c3] bg-[#f7f3ea] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#8a806f]">ecossistema MIAR</p>
              <h3 className="mt-2 text-2xl font-semibold text-[#2d2939]">10 módulos para conectar EDITA, rotina, proteção e nuvem.</h3>
            </div>
            <div className="rounded-full border border-[#d7d0c3] bg-[#eee9df] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6c675f]">
              foco principal: EDITA
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {ecosystemModules.map((module) => (
                <button
                  key={module.key}
                  type="button"
                  onClick={() => setSelectedModule(module)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedModule.key === module.key ? 'border-[#2d2939] bg-[#2d2939] text-[#f7f2e8]' : 'border-[#d7d0c3] bg-[#fdfbf5] text-[#2d2939] hover:border-[#b9b09f] hover:bg-[#fbf7ea]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{module.name}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${selectedModule.key === module.key ? 'bg-white/15 text-[#f7f2e8]' : 'bg-[#eee9df] text-[#6c675f]'}`}>
                      {module.status}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${selectedModule.key === module.key ? 'text-[#e8e1d1]' : 'text-[#6d675f]'}`}>{module.description}</p>
                </button>
              ))}
            </div>

            <div className={`rounded-3xl border p-5 ${selectedModule.key === 'edita' ? 'border-[#d7d0c3] bg-[#2d2939] text-[#f7f2e8]' : 'border-[#d7d0c3] bg-[#fbf7ea] text-[#2d2939]'}`}>
              <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${selectedModule.key === 'edita' ? 'bg-white/15 text-[#d6f05f]' : 'bg-[#eee9df] text-[#6c675f]'}`}>
                {selectedModule.status}
              </div>
              <h4 className="mt-3 text-xl font-semibold">{selectedModule.name}</h4>
              <p className={`mt-3 text-sm leading-7 ${selectedModule.key === 'edita' ? 'text-[#ddd5c3]' : 'text-[#6c675f]'}`}>{selectedModule.detail}</p>
              <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${selectedModule.key === 'edita' ? 'bg-[#d3f055] text-[#2d2939]' : 'bg-[#2d2939] text-[#f7f2e8]'}`}>
                {selectedModule.actionLabel}
                <span className="text-xs">↗</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-[#d5cec1] pt-5 text-[10px] uppercase tracking-[0.15em] text-[#9a9185] sm:flex-row">
          <span>miar suite / edit room</span>
          <span className="flex items-center gap-2"><Mic size={12} /> edição responsável · publicação · nuvem · tradução</span>
        </footer>
      </main>
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