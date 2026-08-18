# Estado de implementação — MIAR MVP

## Resumo executivo

A cópia de implementação contém agora um caminho funcional de MVP com frontend MIAR Pessoal, API Express, schema PostgreSQL, sessões privadas de staging, histórias, conversas, mensagens, anexos persistentes configuráveis e integração server-side com um fornecedor compatível com OpenAI.

O pacote está preparado para staging, mas ainda não é um produto público final: faltam credenciais reais, execução de migrations num PostgreSQL, configuração de um bucket S3 compatível e validação num deploy real do Render.

## O que está implementado

| Área | Implementação |
|---|---|
| Compilação | Typecheck e build de backend, MIAR Pessoal, MIAR Edita e mockup. |
| Banco | Tabelas de utilizadores, sessões, histórias, conversas, mensagens e memórias, com anexos enriquecidos em JSONB. |
| Migrations | Migrations Drizzle existentes e comandos raiz `db:generate` e `db:migrate`. |
| API | Health check, login, logout, utilizador actual, histórias, conversas, mensagens e anexos. |
| Storage | Fallback local no desenvolvimento; S3 compatível em produção, incluindo AWS S3, Cloudflare R2 e MinIO através de endpoint configurável. |
| Upload | Multipart com limite de 25 MB, validação de MIME, nome sanitizado, chave por utilizador e leitura protegida por sessão. |
| IA | Adaptador server-side OpenAI compatível, modo demo explícito e conteúdo multimodal `image_url` para imagens guardadas. |
| Frontend | Upload real de ficheiros, miniaturas, captura pela câmera como `File`, remoção de anexos e associação dos resultados persistidos às mensagens. |
| Segurança inicial | Sessão HTTP-only, expiração, CORS configurável, preflight de produção, limite JSON de 2 MB e ausência do cabeçalho de desenvolvimento em staging autenticado. |
| Protecção operacional | Rate limiting em memória de 20 mensagens de IA/minuto e 30 uploads/minuto, com cabeçalhos `X-RateLimit-*` e `Retry-After`. |
| Contrato | OpenAPI actualizado com `/uploads`, leitura de anexos e campos `id`, `key` e `url`. |
| Deploy | `render.yaml` preparado para API e frontend, com variáveis S3 e limite de imagem declarados como configuração de serviço. |

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `pnpm run typecheck` | Passou em todos os pacotes e scripts. |
| `pnpm run build` | Passou no backend, MIAR Pessoal, MIAR Edita e mockup. Existem apenas avisos não bloqueantes de sourcemap do tooltip. |
| `pnpm audit --prod` | Nenhuma vulnerabilidade conhecida encontrada na verificação anterior da entrega. Deve ser repetido antes do deploy final. |
| `pnpm run smoke:api` | Passou: autenticação, validação, isolamento entre utilizadores, histórias, conversas, contexto total, upload, download protegido, anexos e resposta demo. |
| `pnpm run smoke:vision` | Passou: imagem carregada, persistida e enviada a um fornecedor OpenAI compatível como `data:image/png;base64,...` em `image_url`. |
| `pnpm run check:staging` | Em produção incompleta falha cedo com a lista de variáveis em falta; com configuração S3 fictícia completa passa e avisa quando `AI_MODE=demo`. |
| Build de produção | Passou após a implementação do storage e da visão multimodal. |

## Configuração local

Para desenvolvimento sem serviços externos, copiar `.env.example` e manter:

```bash
STORAGE_PROVIDER=local
AI_MODE=demo
DATABASE_URL=
```

Depois executar:

```bash
pnpm install
pnpm run typecheck
pnpm run smoke:api
pnpm run smoke:vision
pnpm run build
```

Neste modo, os ficheiros são guardados em `UPLOAD_DIR` e os dados em memória quando não existe `DATABASE_URL`. Ambos são apropriados para testes locais, não para persistência de produção.

## Configuração do Render

O serviço de API exige, em produção, `DATABASE_URL`, `MIAR_ACCESS_TOKEN`, `WEB_ORIGIN`, `STORAGE_PROVIDER=s3`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID` e `STORAGE_SECRET_ACCESS_KEY`. Para AWS S3, o endpoint pode ficar vazio; para Cloudflare R2 ou MinIO, preencher `STORAGE_ENDPOINT` e rever `STORAGE_FORCE_PATH_STYLE` conforme o fornecedor.

A IA real exige `OPENAI_API_KEY` quando `AI_MODE` não é `demo`. Os nomes dos serviços e domínios em `render.yaml` são placeholders e devem ser confirmados no painel do Render antes da publicação.

## Limitações que permanecem

A autenticação continua a ser um login privado por token partilhado, adequado para staging, mas não equivalente a contas individuais com OAuth, recuperação de acesso, gestão de equipas e permissões granulares. O rate limiting actual é por processo; para múltiplas instâncias deve ser migrado para Redis ou outro armazenamento partilhado.

Ainda não existe memória semântica com embeddings, quotas financeiras por utilizador, observabilidade centralizada, backups automatizados ou testes E2E contra o Render real. A análise multimodal está preparada para fornecedores que aceitem `image_url`, mas depende do modelo configurado suportar visão e do limite de contexto desse fornecedor.

## Critério de aceite da próxima publicação

O staging será considerado aceite quando, com PostgreSQL, bucket S3 e chaves configuradas, uma pessoa conseguir entrar, criar uma história, criar uma conversa, anexar uma imagem, receber uma resposta real ou demo, actualizar a página e recuperar o histórico e o anexo sem acesso cruzado entre utilizadores.
