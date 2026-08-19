# MIAR — Checklist final de estado

**Data:** 19 de agosto de 2026  
**Ramo:** `staging/mvp-deploy-final`  
**Repositório:** [MIAR-ARI4 no GitHub](https://github.com/robsonpaulistarj-ctrl/MIAR-ARI4)  
**Frontend:** [miar-web.onrender.com](https://miar-web.onrender.com)  
**API:** [miar-api-texv.onrender.com](https://miar-api-texv.onrender.com)  
**Healthcheck:** [miar-api-texv.onrender.com/api/healthz](https://miar-api-texv.onrender.com/api/healthz)

## Resultado desta sessão

A falha de TypeScript foi corrigida no cliente web: `sendRemoteMessage` agora aceita `useAllStoryConversations`, e o `pnpm typecheck` passou para todos os pacotes. O build do frontend e da API também passou; o aviso de sourcemap de `tooltip.tsx` não impediu o build e não foi tratado como falha de compilação.

O backend passou a separar, na construção do contexto, **“ler todas as histórias”** de **“ler todas as conversas anteriores desta história”**. A implementação foi aplicada tanto ao caminho PostgreSQL como ao caminho de memória. Foram também publicados ajustes para a voz automática, o fecho do menu ao escolher uma história, o botão explícito **live** da câmera e a distinção entre visualização ao vivo e captura de imagem.

Foram enviados para o GitHub os commits `3172a1a`, `5d90ac5`, `f3a30eb` e `a7f85ef`. O último commit do ramo é `a7f85ef`, e o repositório local ficou limpo depois do push.

## Checklist por função

| Função | Estado honesto | Evidência ou limitação |
|---|---|---|
| Typecheck do monorepo | **Confirmado** | `pnpm typecheck` passou para API, frontend e restantes pacotes. |
| Build de produção | **Confirmado localmente** | `pnpm build` passou; o build específico do frontend também passou. |
| API pública | **Confirmado** | O endpoint de health respondeu `{"status":"ok"}` depois do arranque do Render. |
| Frontend público acessível | **Confirmado** | O endereço público respondeu HTTP 200 e carregou o HTML da aplicação. |
| Deploy do último bundle de UX | **Por confirmar** | O bundle público observado durante o polling ainda continha textos antigos. O painel Render redireccionou para login nesta sessão, portanto não foi possível confirmar o deploy de `f3a30eb` no serviço `miar-web`. |
| Auto-deploy do backend | **Configurado no código** | O blueprint principal mantém `autoDeployTrigger: commit` no `miar-api`. |
| Auto-deploy do frontend | **Corrigido no código; confirmação pendente** | Foi adicionado `autoDeployTrigger: commit` também ao `miar-web` no `render.yaml`, commit `5d90ac5`. É necessário confirmar a sincronização do blueprint no painel Render. |
| Acesso sem login | **Configurado e observado anteriormente** | `MIAR_PUBLIC_ACCESS=true`, `VITE_PUBLIC_ACCESS=true` e `VITE_AUTH_REQUIRED=false`; deve ser revalidado no bundle que sair do próximo deploy. |
| PostgreSQL permanente | **Implementado; reinício completo não testado nesta sessão** | O blueprint liga `miar-db`; as migrações são executadas no arranque. Falta criar um registo, reiniciar o serviço e confirmar a permanência. |
| Anexos em PostgreSQL | **Implementado; reinício completo não testado** | O provider `database` grava os bytes na tabela `attachments_data`; falta validar upload e recuperação depois de reinício. |
| Sincronização SSE | **Implementada; dois dispositivos não testados** | Existe subscrição de eventos por conversa; falta abrir a mesma conversa em PC e celular e confirmar a atualização imediata. |
| Rotação de múltiplas chaves | **Implementada no backend; não testada com chaves reais** | O adaptador usa chaves do painel e fallback para variáveis numeradas; falta simular uma falha de cota e observar a rotação. |
| Painel de APIs | **Implementado; não testado em produção** | Inclui adicionar, mascarar, editar, ligar/desligar e excluir. Requer o `MIAR_SETTINGS_TOKEN` configurado no Render, sem enviar o segredo pelo chat. |
| IA real | **Ainda não activa** | O blueprint permanece em `AI_MODE=demo`; é necessário configurar a chave no Render e mudar o modo/base/modelo conforme o fornecedor. |
| Voz automática | **Código corrigido; teste manual pendente** | A fala reconhecida é enviada após três segundos de silêncio e a resposta é encaminhada para `speechSynthesis`; falta testar no Chrome do PC e no navegador do celular. |
| Resposta falada automática | **Implementada no código; teste manual pendente** | A aplicação chama `speakText` para a resposta remota ou demo quando a voz está ligada. |
| Câmera live | **Código corrigido; teste manual pendente** | O botão mostra `live`, abre o stream e exibe o vídeo; a captura cria um anexo separado. |
| Fecho automático do menu | **Código corrigido; teste manual pendente** | Seleccionar uma história ou criar uma história fecha o menu; Configurações também colapsa o menu e abre o modal. |
| Remoção de poluição visual | **Código actualizado; produção pendente** | O texto “control panel de voz e anexos” foi substituído por “Voz, câmera e anexos”; a produção observada ainda serviu um bundle antigo. |

## Acção necessária no Render

Sem enviar nenhuma chave pelo chat, entrar no painel do Render usando a conta do utilizador e abrir o blueprint `exs-da26411t0dsc73b6hfl0`. Confirmar que o ramo é `staging/mvp-deploy-final`, que os dois serviços usam `autoDeployTrigger: commit` e que o `miar-web` iniciou um deploy a partir do código que contém o commit `f3a30eb`. Se o blueprint mostrar uma alteração pendente, sincronizá-la; se o serviço web continuar no bundle antigo, usar **Manual Deploy → Deploy latest commit** uma única vez para destravar a propagação. Depois, abrir o endereço público numa janela privada e confirmar que os textos antigos desapareceram.

## Testes finais recomendados

O primeiro teste deve criar uma história, uma conversa e três mensagens, reiniciar o serviço `miar-api` e confirmar que as mensagens permanecem. O segundo deve carregar um anexo, reiniciar novamente e confirmar que o anexo pode ser aberto. O terceiro deve configurar as chaves apenas no Render, activar o modo live e enviar uma mensagem; a chave nunca deve ser colada no chat. O quarto deve abrir a mesma conversa no PC e no celular e confirmar a sincronização. O quinto deve testar, no celular, o botão de microfone, o envio automático após silêncio, a leitura da resposta, o botão **live** da câmera e a captura de uma imagem.

> **Conclusão:** o código pendente foi corrigido, validado localmente e publicado. A API está saudável. O ponto que impede declarar o MVP totalmente concluído é a confirmação do último deploy do `miar-web` e os testes manuais de produção que dependem de login no Render e de acesso aos dispositivos do utilizador. Nenhuma dessas partes deve ser marcada como concluída sem essa confirmação.

## Referências

[1]: https://github.com/robsonpaulistarj-ctrl/MIAR-ARI4 "Repositório MIAR-ARI4"
[2]: https://miar-web.onrender.com "Frontend público do MIAR"
[3]: https://miar-api-texv.onrender.com/api/healthz "Healthcheck público da API MIAR"
[4]: https://dashboard.render.com/web/srv-da264iugekts738do9tg/deploys "Deploys do serviço miar-web no Render"
