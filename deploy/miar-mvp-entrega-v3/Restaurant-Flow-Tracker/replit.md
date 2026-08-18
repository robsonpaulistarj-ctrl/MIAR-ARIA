# Restaurant Flow Tracker (MIAR)

Sistema multi-tenant de gestão de restaurantes com 9 apps (api-server + 8 frontends).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (porta 8080, proxy em /api)
- `pnpm run typecheck` — typecheck completo (11 projetos, zero erros)
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regerar hooks React Query e schemas Zod
- `pnpm --filter @workspace/db run push` — aplicar schema no banco (dev)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Pino (logging via `req.log`, nunca `console.log`)
- DB: PostgreSQL + Drizzle ORM (schema em `lib/db/src/schema/index.ts`)
- Validação: Zod (`zod/v4`), `drizzle-zod`
- AI: Groq (GROQ_API_KEY) — não usar xAI (pago, sem tier gratuito)
- Codegen: Orval (OpenAPI → React Query hooks)
- Build: esbuild (CJS bundle)

## Artifacts (9 apps)

| App | Path | Porta | Função |
|-----|------|-------|--------|
| api-server | /api | 8080 | Backend Express |
| cliente | / | 25854 | App do cliente (QR mesa) |
| caixa | /caixa/ | 25573 | Caixa / pagamentos |
| cozinha | /cozinha/ | 25504 | Fila da cozinha |
| garcom | /garcom/ | 24520 | App do garçom |
| equipe | /equipe/ | 25275 | Portal da equipe |
| entregador | /entregador/ | 21619 | App do entregador |
| gestor | /gestor/ | 25408 | Painel gestor (web) |
| gestor-mobile | /gestor-mobile/ | 19646 | Painel gestor (mobile) |

## Where things live

- Schema DB: `lib/db/src/schema/index.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- API routes: `artifacts/api-server/src/routes/`
- Hooks gerados: `lib/api-client-react/src/generated/`
- Schemas Zod: `lib/api-zod/src/generated/`
- Voice PTT: `lib/voice-ptt/`

## Architecture decisions

- **Multi-tenant**: `restaurantId` SEMPRE vem do JWT, nunca do body da requisição.
- **Persistência híbrida**: dados operacionais (pedidos, mesas, sessões) em memória + `scheduleSave` para `store_snapshots` no Postgres. Dados estruturais (companies, owner_accounts, employee_tokens) direto em SQL.
- **PIN de funcionário**: salvo com bcrypt (nunca texto puro). Login via `POST /api/auth/employee-login` com `{"token": "XXXX"}` (4-6 dígitos).
- **Sessão de mesa**: fluxo `join → addItems → pay → close (exit QR)`. Mesa passa por `free → occupied → paid → cleaning → free`.
- **AI**: usar Groq (GROQ_API_KEY), não xAI.

## Bug corrigido (sessão anterior)

`restaurantId` ausente em pedidos criados via QR de mesa bloqueava a proteção multi-tenant e impedia a cozinha de alterar status do pedido. Corrigido: `kitchenOrder.restaurantId` agora é sempre atribuído da mesa, nunca fica `null`.

## Fluxo de teste QA confirmado (2026-08-06)

1. Cadastro: `POST /api/auth/register/start`
2. Funcionários: `POST /api/employees` (PIN hasheado)
3. Mesa: `POST /api/tables`
4. Item: `POST /api/menu-items`
5. Cliente entra: `POST /api/tables/by-token/:token/session/join`
6. Adiciona item: `POST /api/tables/by-token/:token/session/items` com `{guestId, items:[{menuItemId,quantity}]}`
7. Cozinha: `PATCH /api/orders/:id/status` → preparing → ready
8. Caixa abre: `POST /api/cashier/session/open` com `{initialFloat, operatorName}`
9. Pagamento: `POST /api/tables/by-token/:token/session/pay` com `{guestId, method, markedByStaff}`
10. Fecha sessão (exit QR): `POST /api/tables/by-token/:exitToken/session/close`
11. Mesa → free: `PATCH /api/tables/:id/status` com `{status:"free"}`

## User preferences

- Não usar xAI — usar Groq (GROQ_API_KEY, tier gratuito)
- Sempre colar saída HTTP real dos comandos de verificação
- Não declarar etapa concluída sem evidência real do comando

## Gotchas

- `pnpm run dev` na raiz não funciona (sem script dev na raiz)
- Verificar com `pnpm --filter @workspace/<slug> run typecheck`, não `build`
- Após qualquer mudança em `lib/*`, rodar `pnpm run typecheck:libs` antes dos artifacts
- O rate-limiter de AI (`aiLimiter`) bloqueia rotas de chat/transcrição sem GROQ_API_KEY configurada
- `POST /auth/register` retorna 410 (deprecated) — usar `POST /auth/register/start`
- `REGISTRATION_SMS_ENABLED` não definido = cadastro direto sem OTP

## Pointers

- Ver `pnpm-workspace` skill para estrutura do monorepo
- Ver `lib/db/drizzle.config.ts` para config do banco
