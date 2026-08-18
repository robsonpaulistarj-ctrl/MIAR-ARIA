# Notas técnicas da implementação

## Fontes e base de trabalho

- Repositório GitHub de referência: https://github.com/robsonpaulistarj-ctrl/MIAR-ARI4
- Ficheiro recebido: `/home/ubuntu/upload/miar-mvp-entrega-v3.zip`
- Base trabalhada: `/home/ubuntu/miar-mvp-entrega-v3`

A implementação foi aplicada ao MVP web anexado, que contém `artifacts/miar-pessoal`, `artifacts/api-server`, schema Drizzle/PostgreSQL, migrations, documentação e smoke tests. O repositório GitHub tem uma estrutura diferente e não foi sobrescrito automaticamente.

## Funcionalidades implementadas

1. O backend passou a aceitar upload multipart com limite de 25 MB, validação de MIME, nome sanitizado, chave por utilizador e leitura protegida por sessão.
2. O storage usa fallback local em desenvolvimento e S3 compatível em produção, suportando AWS S3, Cloudflare R2 e MinIO através de `STORAGE_ENDPOINT`.
3. O frontend envia ficheiros reais antes de persistir a mensagem remota, mantém miniaturas e transforma a captura da câmera em `File`.
4. O adaptador de IA aceita conteúdo multimodal e envia imagens persistidas como `image_url` em data URL para fornecedores compatíveis com OpenAI.
5. O contexto total de histórias permanece activo no modo memória e PostgreSQL.
6. O preflight exige PostgreSQL, token, origem web e configuração S3 em produção; CORS e o cabeçalho de desenvolvimento ficam protegidos.
7. Foram adicionados rate limits locais de 20 mensagens de IA por minuto e 30 uploads por minuto.
8. OpenAPI, `.env.example`, `render.yaml`, `STATUS-IMPLEMENTACAO.md` e `COMO-RODAR-MVP.md` foram actualizados.

## Verificações finais

Foram executados com sucesso:

```bash
pnpm run typecheck
pnpm run build
pnpm audit --prod
pnpm run smoke:api
pnpm run smoke:vision
```

O smoke da API verifica autenticação, isolamento entre utilizadores, histórias, conversas, contexto total, upload, download protegido, anexos e resposta demo. O smoke multimodal inicia um fornecedor OpenAI compatível falso e confirma que uma imagem chega ao fornecedor como `data:image/png;base64,...` dentro de `image_url`. O build emite apenas avisos não bloqueantes de sourcemap do tooltip.

## Variáveis que dependem do Render

Em produção, preencher no serviço da API:

```dotenv
DATABASE_URL=...
MIAR_ACCESS_TOKEN=...
WEB_ORIGIN=https://...
STORAGE_PROVIDER=s3
STORAGE_BUCKET=...
STORAGE_REGION=auto
STORAGE_ENDPOINT=...
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
OPENAI_API_KEY=...
```

`OPENAI_API_KEY` só é obrigatório quando `AI_MODE` não é `demo`. As credenciais nunca devem ser commitadas nem enviadas pelo chat. O rate limiting actual é por processo; em múltiplas instâncias deve ser migrado para Redis ou outro armazenamento partilhado.

## Trabalho ainda dependente de produção

Ainda falta executar migrations e smoke tests no Render real, configurar um bucket S3, confirmar os domínios gerados, substituir o token partilhado por contas individuais e acrescentar memória semântica, quotas distribuídas, observabilidade e backups.
