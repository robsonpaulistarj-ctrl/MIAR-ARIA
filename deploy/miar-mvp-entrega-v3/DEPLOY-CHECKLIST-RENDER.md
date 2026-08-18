# Checklist de publicação no Render

## Estado actual

O código do MVP está pronto para staging e o `render.yaml` define dois serviços: `miar-api` e `miar-web`. A publicação real ainda depende de serviços externos e de segredos que não devem ser colocados no repositório.

## 1. Serviço da API

No serviço `miar-api`, confirmar:

| Variável | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `AI_MODE` | Começar por `demo`; mudar para `live` depois do smoke manual. |
| `OPENAI_API_BASE` | `https://api.openai.com/v1` ou endpoint compatível. |
| `OPENAI_MODEL` | Modelo de texto com suporte a visão. |
| `AI_MAX_IMAGE_BYTES` | `10485760` |
| `LOG_LEVEL` | `info` |
| `WEB_ORIGIN` | URL pública exacta do frontend. |

Preencher como segredos:

```dotenv
DATABASE_URL=postgresql://...
MIAR_ACCESS_TOKEN=...
OPENAI_API_KEY=...
STORAGE_BUCKET=...
STORAGE_ENDPOINT=...
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
```

E configurar como valores normais:

```dotenv
STORAGE_PROVIDER=s3
STORAGE_REGION=auto
STORAGE_FORCE_PATH_STYLE=false
```

Para AWS S3, deixar `STORAGE_ENDPOINT` vazio. Para Cloudflare R2, usar o endpoint S3 do bucket e a região `auto`. Para MinIO, usar o endpoint acessível pelo Render e verificar `STORAGE_FORCE_PATH_STYLE`.

## 2. PostgreSQL

Criar ou seleccionar uma base PostgreSQL acessível pelo serviço da API. Depois de a variável `DATABASE_URL` estar disponível, executar uma vez no ambiente com acesso à base:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
```

Confirmar em seguida:

```bash
curl https://DOMINIO-DA-API.onrender.com/api/healthz
```

## 3. Serviço web

No serviço `miar-web`, confirmar:

```dotenv
VITE_API_URL=https://DOMINIO-DA-API.onrender.com/api
VITE_AUTH_REQUIRED=true
```

Depois de o domínio final do frontend existir, copiar esse domínio para `WEB_ORIGIN` no serviço da API e fazer um novo deploy da API.

## 4. Ordem segura do primeiro deploy

1. Publicar a API em `AI_MODE=demo` com PostgreSQL e S3 configurados.
2. Confirmar `/api/healthz`.
3. Abrir o frontend e testar login, criação de história, conversa e mensagem.
4. Testar upload de uma imagem, refresh e download.
5. Confirmar que uma segunda sessão não consegue ler o primeiro anexo.
6. Activar `OPENAI_API_KEY` e mudar para `AI_MODE=live`.
7. Testar texto e imagem com o modelo configurado.

## 5. Critérios de aceite

O staging passa quando os dados sobrevivem a um reinício, os anexos sobrevivem a refresh/redeploy, o CORS só aceita o domínio do frontend, o login exige a sessão HTTP-only e o modelo responde a texto e imagem sem expor chaves no browser.

## 6. Bloqueios conhecidos

O painel do Render não respondeu durante a tentativa de acesso automatizado. Sem acesso ao painel ou sem credenciais de PostgreSQL, S3 e IA, não é possível confirmar o deploy real a partir do sandbox. O pacote e a configuração estão preparados para retomar exactamente a partir deste checklist.
