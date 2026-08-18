# Estado da persistência do MIAR

## Diagnóstico

A API já tinha o caminho PostgreSQL implementado através de Drizzle em `lib/db/src/index.ts`. Quando `DATABASE_URL` existe, `db` é criado com `drizzle-orm/node-postgres`; sem essa variável, a aplicação usa `memory-store.ts` se `ALLOW_EPHEMERAL_DB=true`.

O Blueprint em produção mantinha `ALLOW_EPHEMERAL_DB=true` e `DATABASE_URL` sem ligação a uma base Render. Por isso, utilizadores, sessões, histórias, conversas e mensagens eram mantidos apenas na memória do processo e podiam desaparecer num reinício.

## Alterações publicadas

A commit `782dcb4` foi enviada para `staging/mvp-deploy-final` em 18 de Agosto de 2026. Os Blueprints raiz e do pacote foram actualizados para:

- desligar o modo temporário com `ALLOW_EPHEMERAL_DB=false`;
- ligar `DATABASE_URL` à base Render `miar-db` através de `fromDatabase.connectionString`;
- declarar `miar-db` como PostgreSQL `free`, com database `miar` e utilizador `miar`;
- executar `pnpm db:migrate` em `preDeployCommand` antes do arranque da API;
- manter a URL correcta do frontend: `https://miar-api-texv.onrender.com/api`.

## Próxima validação operacional

É necessário o Render sincronizar o Blueprint e concluir o deploy. Depois deve ser confirmado no serviço `miar-api` que `DATABASE_URL` está ligado à base `miar-db`, que o pre-deploy aplicou as migrações e que `/api/healthz` continua a responder. A validação final consiste em criar uma história, reiniciar a API e confirmar que a história permanece.

A página do Render não ficou acessível na sessão técnica porque abriu sem conteúdo em `about:blank`; não foram lidos nem solicitados segredos.

## Referências oficiais consultadas

- Render Blueprint YAML Reference: https://render.com/docs/blueprint-spec — confirma `databases`, `fromDatabase` com `property: connectionString` e `preDeployCommand`.
- Render Postgres: https://render.com/docs/postgresql-creating-connecting — confirma que o PostgreSQL gerido fornece URL interna e externa; serviços Render devem usar a URL interna quando possível.

## Configuração temporária pública

O utilizador confirmou que, nesta fase, aceita o acesso sem login. A API usa `MIAR_PUBLIC_ACCESS=true` para encaminhar todos os pedidos para o utilizador partilhado `public@miar.local`, enquanto o frontend usa `VITE_AUTH_REQUIRED=false` e entra directamente.

Esta configuração é deliberadamente temporária: qualquer pessoa com o URL poderá aceder aos mesmos dados. Para reactivar a privacidade, basta definir `MIAR_PUBLIC_ACCESS=false` e `VITE_AUTH_REQUIRED=true`, mantendo `MIAR_ACCESS_TOKEN` configurado.

O plano Free do Render não aceita `preDeployCommand`. Por isso, o Blueprint executa `pnpm db:migrate` no início do `startCommand`, antes do preflight e do arranque da API. O schema continua a ser aplicado automaticamente quando o serviço inicia.

## Confirmação oficial sobre o plano Free

A documentação oficial do Render confirma que o plano Free pode alojar Web Services, Static Sites e Render Postgres, mas tem limitações próprias. A página de deploys descreve `preDeployCommand` como uma etapa opcional do pipeline e informa que falhas nessa etapa cancelam o deploy; no MIAR, o painel confirmou especificamente que essa etapa não é suportada pelo serviço Free. A migração foi, portanto, movida para o `startCommand`, que é o comando de arranque suportado pelo serviço.

A documentação também confirma que serviços Free podem reiniciar ou dormir por inactividade e que o filesystem é efémero, mas que dados relacionais podem ser persistidos no Render Postgres. O PostgreSQL Free tem, contudo, limite de 30 dias e não oferece backups; isto deve ser tratado como staging temporário.

Fontes: https://render.com/docs/free (Deploy for Free — Preview the Render platform with free web services and datastores); https://render.com/docs/deploys (Deploying on Render — Understand how deploys work); https://render.com/docs/web-services (Web Services — Host dynamic web apps).
