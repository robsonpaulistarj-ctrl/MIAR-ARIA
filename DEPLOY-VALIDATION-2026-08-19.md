# Validação do deploy — 2026-08-19

O commit `3172a1a` foi enviado para `staging/mvp-deploy-final` e o repositório local está limpo após o push.

A validação local passou com `pnpm typecheck && pnpm build`. O endpoint público `https://miar-api-texv.onrender.com/api/healthz` inicialmente mostrou a tela de arranque do Render, mas respondeu depois com `{"status":"ok"}`. Isto confirma que o serviço voltou a ficar operacional após o novo deploy.

O frontend público continuou a responder HTTP 200 em `https://miar-web.onrender.com`. A data do cabeçalho observada ainda corresponde ao artefacto anterior; é necessário validar visualmente o frontend após a propagação do novo build/cache.

## Verificação adicional

O frontend respondeu, mas a página observada ainda contém elementos técnicos antigos, como “Painel de funções”, “control panel de voz e anexos”, “contexto total” e “controles arrastáveis”. Isso indica que o novo artefacto ainda não estava visível nessa verificação — possivelmente porque o serviço web ainda não iniciou o deploy ou por cache do CDN. Portanto, não se deve considerar a limpeza visual publicada como validada.

A abertura do painel de deploys do Render não carregou dados utilizáveis nesta sessão; o estado do deploy do serviço web permanece por confirmar no painel.

## Depois da correcção do blueprint

Após o commit `5d90ac5`, a API voltou a responder `{"status":"ok"}` e o HTML do frontend passou a referenciar novos artefactos (`/assets/index-CnygCVaa.js` e `/assets/index-B9FCTMis.css`), confirmando que o Render publicou um build diferente do anterior. A sessão visual do browser não conseguiu manter a navegação (voltou a `about:blank`), por isso a confirmação de conteúdo da interface foi feita pelo artefacto HTML e deve ser complementada pelo teste manual no dispositivo do utilizador.

## Estado do painel Render

O painel do Render redireccionou para autenticação nesta sessão. O conector My Browser está disponível, mas não há sessão autenticada acessível pelo browser desta tarefa. Não foram solicitadas nem introduzidas credenciais no chat.

O endpoint público da API continua saudável, mas o frontend ainda serviu o bundle antigo durante o polling após `f3a30eb`; o deploy do serviço `miar-web` precisa ser confirmado no painel Render ou num browser autenticado do utilizador.
