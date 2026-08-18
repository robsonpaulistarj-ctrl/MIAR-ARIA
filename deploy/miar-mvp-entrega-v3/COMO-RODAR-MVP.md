# Como executar o MIAR MVP

Este pacote contém uma implementação funcional de MVP com frontend MIAR Pessoal, API Express, persistência opcional em PostgreSQL, upload de anexos e análise multimodal através de um fornecedor compatível com OpenAI.

## Pré-requisitos

É necessário Node.js 22 ou superior e pnpm 11 ou superior. O PostgreSQL 14 ou superior é necessário para persistência durável. Sem `DATABASE_URL`, o backend entra em modo memória durante o desenvolvimento; este modo perde os dados quando o processo reinicia.

Para respostas reais, é necessária uma chave de um fornecedor compatível com a API OpenAI cujo modelo suporte texto. Para análise de imagens, o modelo configurado também deve suportar visão.

## Configuração local

Na raiz do projecto, copie o exemplo de ambiente:

```bash
cp .env.example .env
```

Para começar sem serviços externos, mantenha:

```dotenv
NODE_ENV=development
DATABASE_URL=
STORAGE_PROVIDER=local
AI_MODE=demo
```

Os uploads locais ficam em `UPLOAD_DIR`, por defeito `./data/uploads`. O `.gitignore` já exclui essa pasta, dependências, builds e ficheiros de ambiente privados.

Para persistência durável, preencha `DATABASE_URL` e execute as migrations. Para IA real, preencha `OPENAI_API_KEY` e use `AI_MODE=live`. Para testar um endpoint OpenAI compatível, configure também `OPENAI_API_BASE` e `OPENAI_MODEL`.

## Criar as tabelas

Para testar rapidamente sem banco, pode saltar esta secção. Para persistência PostgreSQL:

```bash
pnpm install
pnpm db:migrate
```

Num banco descartável, também é possível sincronizar directamente o schema:

```bash
pnpm --filter @workspace/db push
```

## Iniciar localmente

A forma recomendada é iniciar a API e o MIAR Pessoal em paralelo:

```bash
pnpm dev
```

Abra o endereço apresentado pelo Vite, normalmente `http://localhost:5173`. Em terminais separados, use `pnpm dev:api` e `pnpm dev:miar`.

O health check da API está disponível em:

```bash
curl http://localhost:8080/api/healthz
```

A resposta esperada é `{"status":"ok"}`.

## Fluxo funcional

No frontend, crie uma história, abra uma conversa, escreva uma mensagem e, opcionalmente, seleccione um ficheiro ou capture uma imagem pela câmera. Quando o backend está ligado, o frontend envia primeiro o ficheiro para `/api/uploads`; a mensagem guarda os metadados e a URL protegida devolvida pelo storage.

No modo `AI_MODE=live`, imagens são carregadas pelo backend e enviadas ao fornecedor como conteúdo `image_url`. O limite de leitura para visão é controlado por `AI_MAX_IMAGE_BYTES`, com valor recomendado de 10 MB. O modo demo valida o fluxo, mas não interpreta imagens nem chama um fornecedor externo.

## Verificações oficiais

Execute o conjunto completo antes de entregar uma alteração:

```bash
pnpm run typecheck
pnpm run smoke:api
pnpm run smoke:vision
pnpm run build
pnpm audit --prod
```

O `smoke:api` cobre autenticação, validação, isolamento entre utilizadores, histórias, conversas, contexto total, upload, download protegido e persistência dos anexos. O `smoke:vision` inicia um fornecedor OpenAI compatível falso e confirma que uma imagem chega à API como `image_url`.

## Deploy de staging no Render

O `render.yaml` define uma API e um frontend estático. Antes de publicar, confirme os domínios reais dos serviços e ajuste `WEB_ORIGIN` e `VITE_API_URL` se o Render gerar nomes diferentes.

A API exige em produção:

```dotenv
DATABASE_URL=postgresql://...
MIAR_ACCESS_TOKEN=um-segredo-forte
WEB_ORIGIN=https://dominio-do-frontend
STORAGE_PROVIDER=s3
STORAGE_BUCKET=nome-do-bucket
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://... # opcional para AWS; necessário para R2/MinIO
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
```

Para AWS S3, o endpoint pode ficar vazio. Para Cloudflare R2 ou MinIO, preencha `STORAGE_ENDPOINT` e ajuste `STORAGE_FORCE_PATH_STYLE` conforme o fornecedor. Nunca coloque estes valores no repositório ou numa mensagem pública.

O preflight é executado antes da API iniciar:

```bash
pnpm run check:staging
```

Em `NODE_ENV=production`, ele bloqueia a inicialização quando faltam PostgreSQL, token, origem web, bucket ou credenciais S3. Se `AI_MODE=live`, também exige `OPENAI_API_KEY`.

Depois de criar o PostgreSQL e configurar `DATABASE_URL`, execute a migration com acesso ao mesmo banco:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
```

## Limitações actuais

O login de staging ainda usa um token partilhado e não substitui contas individuais, OAuth ou permissões por equipa. O rate limiting é local ao processo; com múltiplas instâncias deve ser movido para Redis ou outro armazenamento partilhado. Memória semântica com embeddings, quotas financeiras, observabilidade centralizada, backups e testes E2E contra o Render real ainda são trabalho de produção.
