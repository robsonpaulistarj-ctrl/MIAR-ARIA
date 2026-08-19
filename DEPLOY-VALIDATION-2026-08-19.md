# Validação do deploy — 2026-08-19

O commit `3172a1a` foi enviado para `staging/mvp-deploy-final` e o repositório local está limpo após o push.

A validação local passou com `pnpm typecheck && pnpm build`. O endpoint público `https://miar-api-texv.onrender.com/api/healthz` inicialmente mostrou a tela de arranque do Render, mas respondeu depois com `{"status":"ok"}`. Isto confirma que o serviço voltou a ficar operacional após o novo deploy.

O frontend público continuou a responder HTTP 200 em `https://miar-web.onrender.com`. A data do cabeçalho observada ainda corresponde ao artefacto anterior; é necessário validar visualmente o frontend após a propagação do novo build/cache.

## Verificação adicional

O frontend respondeu, mas a página observada ainda contém elementos técnicos antigos, como “Painel de funções”, “control panel de voz e anexos”, “contexto total” e “controles arrastáveis”. Isso indica que o novo artefacto ainda não estava visível nessa verificação — possivelmente porque o serviço web ainda não iniciou o deploy ou por cache do CDN. Portanto, não se deve considerar a limpeza visual publicada como validada.

A abertura do painel de deploys do Render não carregou dados utilizáveis nesta sessão; o estado do deploy do serviço web permanece por confirmar no painel.
