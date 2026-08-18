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
