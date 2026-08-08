import { useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowUp,
  Brain,
  Check,
  ChevronDown,
  Headphones,
  Lightbulb,
  Menu,
  Mic,
  Moon,
  Paperclip,
  Play,
  Radio,
  Settings2,
  Sparkles,
  Sun,
  Waves,
  X,
} from "lucide-react";

type Theme = "claro" | "escuro" | "sistema";
type Message = { role: "user" | "assistant"; text: string };

const prompts = [
  "Quero organizar o que estou sentindo",
  "Ajude-me a retomar uma ideia antiga",
  "O que você lembra sobre mim?",
];

export function MiarAiHome() {
  const [theme, setTheme] = useState<Theme>("claro");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyName, setStoryName] = useState("");
  const [storyCreated, setStoryCreated] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  const [attached, setAttached] = useState(false);
  const [navOpen, setNavOpen] = useState(true);

  const isDark = theme === "escuro";
  const welcome = useMemo(
    () =>
      storyCreated
        ? `Que bom ter você de volta, ${storyName || "aqui"}.`
        : "Um lugar para continuar a sua história.",
    [storyCreated, storyName],
  );

  const notify = (text: string) => {
    setFeedback(text);
    window.setTimeout(() => setFeedback(""), 2200);
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { role: "user", text },
      {
        role: "assistant",
        text: "Estou com você. Vou guardar este fio e pensar com calma antes de responder. Quer começar pelo que parece mais importante agora?",
      },
    ]);
    setInput("");
  };

  const createStory = (event: FormEvent) => {
    event.preventDefault();
    setStoryCreated(true);
    setStoryOpen(false);
    notify("História criada e pronta para continuar.");
  };

  return (
    <div className={`miar-app ${isDark ? "is-dark" : ""}`} data-theme={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
        * { box-sizing: border-box; }
        .miar-app { --ink:#183a31; --sub:#6c8178; --line:#d8e6de; --canvas:#f4f8f5; --panel:#fbfdfb; --soft:#e8f2eb; --brand:#2e785f; --brand-strong:#1e604b; --mint:#d8ece0; --shadow:0 18px 55px rgba(31,76,57,.09); min-height:100vh; background:radial-gradient(circle at 71% 8%,#e7f3e9 0,transparent 27%),var(--canvas); color:var(--ink); font-family:'DM Sans',sans-serif; transition:background .3s,color .3s; }
        .miar-app.is-dark { --ink:#e2f0e7; --sub:#9bb5a5; --line:#284b3e; --canvas:#10291f; --panel:#16382a; --soft:#204938; --brand:#8fd2aa; --brand-strong:#6fbc90; --mint:#234d3a; --shadow:0 18px 55px rgba(0,0,0,.22); background:radial-gradient(circle at 72% 5%,#214c38 0,transparent 28%),var(--canvas); }
        .miar-app button,.miar-app input,.miar-app textarea { font:inherit; }
        .miar-frame { min-height:100vh; display:flex; max-width:1500px; margin:auto; }
        .miar-side { width:285px; padding:27px 18px 20px; background:color-mix(in srgb,var(--panel) 87%,transparent); border-right:1px solid var(--line); display:flex; flex-direction:column; transition:transform .3s; }
        .miar-brand { display:flex; align-items:center; gap:10px; padding:0 10px 29px; }
        .brand-mark { width:37px;height:37px;border-radius:13px;background:var(--brand);color:#f5fbf6;display:grid;place-items:center;font-family:Fraunces,serif;font-size:22px; box-shadow:0 7px 14px rgba(46,120,95,.2); }
        .brand-name { font-weight:700; letter-spacing:-.04em; font-size:20px; }.brand-note { display:block;color:var(--sub);font-size:9px;letter-spacing:.16em;text-transform:uppercase;margin-top:2px; }
        .side-label { color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.15em;padding:0 11px;margin:13px 0 9px; }
        .story-card { display:flex;align-items:center;gap:11px;padding:12px 11px;border:1px solid var(--line);border-radius:14px;background:var(--soft);cursor:pointer;color:var(--ink);text-align:left;width:100%; }
        .story-icon { width:33px;height:33px;border-radius:10px;background:var(--brand);color:#f4fbf6;display:grid;place-items:center; }.story-card strong{font-size:12px;display:block}.story-card span{font-size:10px;color:var(--sub);display:block;margin-top:2px}
        .side-action { width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;color:var(--sub);padding:10px 11px;border-radius:11px;text-align:left;cursor:pointer;font-size:12px; }.side-action:hover{background:var(--soft);color:var(--ink)}.side-action svg{width:16px}
        .memory { margin-top:auto;border:1px solid var(--line);border-radius:17px;padding:14px;background:color-mix(in srgb,var(--soft) 55%,transparent); }.memory-head{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600}.memory-head svg{color:var(--brand);width:16px}.memory p{font-size:10px;line-height:1.5;color:var(--sub);margin:9px 0 12px}.memory-foot{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--sub)}.memory-foot b{color:var(--brand);font-weight:600}
        .miar-main { flex:1;min-width:0;display:flex;flex-direction:column; }.topbar{height:74px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 36px}.top-left{display:flex;align-items:center;gap:11px;font-size:11px;color:var(--sub)}.pulse{width:8px;height:8px;background:var(--brand);border-radius:50%;box-shadow:0 0 0 5px color-mix(in srgb,var(--brand) 13%,transparent)}.top-actions{display:flex;align-items:center;gap:9px}.icon-btn{border:1px solid transparent;background:transparent;color:var(--sub);border-radius:10px;padding:8px;cursor:pointer}.icon-btn:hover{background:var(--soft);color:var(--ink)}.avatar{width:30px;height:30px;border-radius:50%;background:var(--mint);display:grid;place-items:center;color:var(--brand-strong);font-size:11px;font-weight:700}
        .work { width:min(900px,100%);margin:auto;flex:1;display:flex;flex-direction:column;padding:38px 34px 25px; }.eyebrow{display:flex;align-items:center;gap:8px;color:var(--brand);text-transform:uppercase;letter-spacing:.17em;font-size:10px;font-weight:700}.hero{margin-top:23px}.hero h1{font-family:Fraunces,serif;font-size:clamp(35px,5vw,57px);line-height:1.02;letter-spacing:-.055em;font-weight:500;max-width:700px;margin:0}.hero p{color:var(--sub);font-size:13px;line-height:1.7;margin:15px 0 0;max-width:570px}
        .empty{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:380px;align-items:center;text-align:center}.empty-orb{width:66px;height:66px;border-radius:24px;display:grid;place-items:center;color:var(--brand);background:var(--mint);margin-bottom:18px;transform:rotate(-4deg)}.empty h2{font-family:Fraunces,serif;font-size:25px;font-weight:500;margin:0;letter-spacing:-.03em}.empty p{font-size:12px;color:var(--sub);max-width:390px;line-height:1.6;margin:9px 0 21px}.suggestions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:650px}.suggestion{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:99px;padding:10px 14px;font-size:11px;cursor:pointer;transition:transform .2s,background .2s}.suggestion:hover{transform:translateY(-2px);background:var(--soft)}
        .messages{flex:1;overflow:auto;padding:28px 3px;display:flex;flex-direction:column;gap:14px}.bubble{max-width:76%;padding:13px 16px;border-radius:16px;font-size:13px;line-height:1.6}.bubble.user{align-self:flex-end;background:var(--brand);color:#f7fcf8;border-bottom-right-radius:4px}.bubble.assistant{align-self:flex-start;background:var(--panel);border:1px solid var(--line);border-bottom-left-radius:4px}.bubble small{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;opacity:.65;margin-bottom:5px}
        .composer{border:1px solid color-mix(in srgb,var(--brand) 35%,var(--line));background:var(--panel);border-radius:20px;padding:10px;box-shadow:var(--shadow);transition:border .2s}.composer:focus-within{border-color:var(--brand)}.composer textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:var(--ink);padding:7px 9px;min-height:70px;line-height:1.5;font-size:13px}.composer textarea::placeholder{color:var(--sub)}.composer-tools{display:flex;align-items:center;justify-content:space-between}.tools-left{display:flex;gap:3px}.tool{border:0;background:transparent;color:var(--sub);padding:8px;border-radius:9px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:10px}.tool:hover,.tool.active{background:var(--soft);color:var(--brand)}.send{border:0;background:var(--brand);color:#f7fcf8;width:37px;height:37px;border-radius:12px;display:grid;place-items:center;cursor:pointer}.send:disabled{opacity:.35;cursor:default}.under{display:flex;justify-content:space-between;color:var(--sub);font-size:9px;letter-spacing:.05em;padding:11px 4px 0}.status{color:var(--brand);font-weight:600}
        .theme-row{display:flex;gap:3px;padding:3px;background:var(--soft);border-radius:11px}.theme-row button{border:0;background:transparent;color:var(--sub);font-size:10px;padding:7px 9px;border-radius:8px;cursor:pointer}.theme-row button.selected{background:var(--panel);color:var(--ink);box-shadow:0 2px 8px rgba(30,80,50,.08)}
        .dialog-back{position:fixed;inset:0;background:rgba(10,35,25,.25);display:grid;place-items:center;z-index:5;padding:20px}.dialog{width:min(390px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:23px;box-shadow:0 24px 80px rgba(14,49,34,.25)}.dialog-head{display:flex;justify-content:space-between;align-items:flex-start}.dialog h3{font-family:Fraunces,serif;font-size:25px;margin:0;font-weight:500}.dialog p{font-size:11px;color:var(--sub);line-height:1.5}.dialog input{width:100%;border:1px solid var(--line);border-radius:10px;padding:11px;background:var(--canvas);color:var(--ink);outline:0;margin:10px 0 15px}.dialog input:focus{border-color:var(--brand)}.dialog-submit{width:100%;border:0;border-radius:10px;padding:11px;background:var(--brand);color:#f5fbf6;font-weight:600;cursor:pointer}
        .toast{position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--canvas);border-radius:99px;padding:10px 15px;font-size:11px;z-index:8;animation:rise .2s ease-out}@keyframes rise{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}} 
        @media(max-width:800px){.miar-side{position:fixed;z-index:4;inset:0 auto 0 0;transform:translateX(-100%);box-shadow:12px 0 40px rgba(0,0,0,.12)}.miar-side.open{transform:none}.topbar{padding:0 17px}.top-left span{display:none}.work{padding:28px 17px 18px}.hero h1{font-size:39px}.empty{min-height:310px}.bubble{max-width:90%}.menu-open{display:block!important}}
        @media(min-width:801px){.menu-open{display:none!important}}
      `}</style>

      <div className="miar-frame">
        <aside className={`miar-side ${navOpen ? "open" : ""}`}>
          <div className="miar-brand">
            <div className="brand-mark">M</div>
            <div><div className="brand-name">MIAR AI</div><span className="brand-note">um espaço para pensar</span></div>
            <button className="icon-btn menu-open" onClick={() => setNavOpen(false)} aria-label="Fechar menu"><X size={17} /></button>
          </div>
          <div className="side-label">Seu espaço</div>
          <button className="story-card" onClick={() => setStoryOpen(true)}>
            <span className="story-icon"><Archive size={16} /></span>
            <span><strong>{storyCreated ? storyName || "Minha história" : "Comece uma história"}</strong><span>{storyCreated ? "continuidade ativa" : "dê um nome ao seu núcleo"}</span></span>
            <ChevronDown size={15} style={{ marginLeft: "auto", color: "var(--sub)" }} />
          </button>
          <div className="side-label">Acesso rápido</div>
          <button className="side-action" onClick={() => notify("Todas as histórias estão em segurança.")}><Archive /> Histórias</button>
          <button className="side-action" onClick={() => notify("A memória da MIAR está ativa.")}><Brain /> Memória persistente <span style={{ marginLeft: "auto", color: "var(--brand)", fontSize: 10 }}>ativa</span></button>
          <button className="side-action" onClick={() => notify("Configurações de provedores em breve.")}><Settings2 /> Provedores e modelos</button>
          <div className="side-label" style={{ marginTop: 19 }}>Aparência</div>
          <div className="theme-row" style={{ margin: "0 9px" }}>
            {([["claro", <Sun size={13} />, "Claro"], ["escuro", <Moon size={13} />, "Escuro"], ["sistema", <Waves size={13} />, "Sistema"]] as const).map(([key, icon, label]) => <button key={key} className={theme === key ? "selected" : ""} onClick={() => setTheme(key)}>{icon} {label}</button>)}
          </div>
          <div className="memory">
            <div className="memory-head"><Brain /> Memória infinita <span style={{ marginLeft: "auto", color: "var(--brand)", fontSize: 10 }}>●</span></div>
            <p>A MIAR mantém o contexto das suas conversas para você nunca precisar começar de novo.</p>
            <div className="memory-foot"><span>18 lembranças guardadas</span><b>gerenciar</b></div>
          </div>
        </aside>

        <main className="miar-main">
          <header className="topbar">
            <div className="top-left"><button className="icon-btn menu-open" onClick={() => setNavOpen(true)} aria-label="Abrir menu"><Menu size={19} /></button><span className="pulse" /> <span>ESPAÇO PRIVADO · MEMÓRIA ATIVA</span></div>
            <div className="top-actions"><span style={{ fontSize: 10, color: "var(--sub)" }}>Gemini 2.0 Flash <span style={{ color: "var(--brand)" }}>●</span></span><button className="icon-btn" onClick={() => notify("Leitura feminina ativada.")} aria-label="Ouvir"><Headphones size={16} /></button><div className="avatar">V</div></div>
          </header>
          <div className="work">
            <section className="hero"><div className="eyebrow"><Sparkles size={13} /> MIAR AI · CONTINUIDADE</div><h1>{welcome}</h1><p>Converse com uma inteligência que escuta com atenção, lembra do que importa e acompanha o seu ritmo.</p></section>
            {messages.length === 0 ? <section className="empty"><div className="empty-orb"><Lightbulb size={29} strokeWidth={1.5} /></div><h2>Por onde começamos?</h2><p>Não precisa formular tudo perfeitamente. Traga uma pergunta, um pensamento solto ou apenas o seu momento.</p><div className="suggestions">{prompts.map((prompt) => <button className="suggestion" key={prompt} onClick={() => setInput(prompt)}>{prompt}<ArrowUp size={12} style={{ marginLeft: 7, transform: "rotate(45deg)", verticalAlign: -2 }} /></button>)}</div></section> : <section className="messages">{messages.map((message, index) => <div className={`bubble ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === "user" ? "Você" : "MIAR AI"}</small>{message.text}{message.role === "assistant" && <button className="tool" onClick={() => notify("Reprodução iniciada com voz feminina.")} style={{ marginTop: 8, padding: "3px 0" }}><Play size={12} /> ouvir resposta</button>}</div>)}</section>}
            <form className="composer" onSubmit={send}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escreva para a MIAR AI..." rows={2} />
              <div className="composer-tools"><div className="tools-left"><button type="button" className={`tool ${attached ? "active" : ""}`} onClick={() => { setAttached(!attached); notify(attached ? "Anexo removido." : "Anexo pronto para enviar."); }}><Paperclip size={16} /> <span className="tool-label">anexo</span></button><button type="button" className={`tool ${micOn ? "active" : ""}`} onClick={() => { setMicOn(!micOn); notify(micOn ? "Microfone pausado." : "Ouvindo você..."); }}><Mic size={16} /> <span className="tool-label">microfone</span></button><button type="button" className={`tool ${liveOn ? "active" : ""}`} onClick={() => { setLiveOn(!liveOn); notify(liveOn ? "Modo ao vivo encerrado." : "Modo ao vivo iniciado."); }}><Radio size={16} /> <span className="tool-label">ao vivo</span></button></div><button className="send" type="submit" disabled={!input.trim()} aria-label="Enviar mensagem"><ArrowUp size={18} /></button></div>
            </form>
            <div className="under"><span>{attached ? "1 arquivo pronto" : "Enter para enviar · Shift + Enter para nova linha"}</span><span className="status">{liveOn ? "● AO VIVO" : micOn ? "● OUVINDO" : "● pronta para pensar"}</span></div>
          </div>
        </main>
      </div>

      {storyOpen && <div className="dialog-back" onClick={() => setStoryOpen(false)}><div className="dialog" onClick={(event) => event.stopPropagation()}><div className="dialog-head"><div><div className="eyebrow">NOVA HISTÓRIA</div><h3>Conte de onde você vem.</h3></div><button className="icon-btn" onClick={() => setStoryOpen(false)} aria-label="Fechar"><X size={17} /></button></div><p>Um pequeno contexto ajuda a MIAR AI a caminhar com você desde a primeira conversa.</p><form onSubmit={createStory}><input autoFocus value={storyName} onChange={(event) => setStoryName(event.target.value)} placeholder="Nome da história (opcional)" /><button className="dialog-submit" type="submit"><Check size={15} style={{ verticalAlign: -3, marginRight: 6 }} /> Criar história</button></form></div></div>}
      {feedback && <div className="toast"><Check size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{feedback}</div>}
    </div>
  );
}

export default MiarAiHome;