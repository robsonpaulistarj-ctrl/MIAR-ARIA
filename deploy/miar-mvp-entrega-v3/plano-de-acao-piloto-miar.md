# Plano de ação — Piloto privado do MIAR

**Autor:** Manus AI  
**Objetivo:** transformar o MVP atual do MIAR Pessoal num piloto privado estável, com dados persistentes e IA real, sem ampliar o escopo antes de validar o núcleo do produto.

## 1. Decisão principal

A recomendação é congelar temporariamente o escopo no **MIAR Pessoal**. O piloto deve fazer apenas quatro coisas muito bem: permitir o acesso de uma pessoa autorizada, criar e selecionar uma história, abrir uma conversa com essa história e enviar mensagens que ficam guardadas para serem reencontradas depois.

Câmera, voz, análise de imagem, memória semântica, múltiplos provedores, módulos adicionais e upload definitivo de ficheiros ficam fora do primeiro piloto. Não são funcionalidades descartadas; ficam adiadas para depois de existir evidência de que o fluxo principal é útil e estável.

> **Critério central:** uma pessoa entra, cria uma história, conversa com a IA, fecha a aplicação, volta mais tarde e encontra a história e o histórico da conversa no mesmo lugar.

## 2. O que precisa ser preparado

Antes de publicar, é necessário escolher um único ambiente de deploy e reunir quatro recursos. O projeto já contém um `render.yaml`, portanto a opção de menor risco é usar o ambiente previsto nele, sem migrar de plataforma durante o piloto.

| Recurso | Para que serve | Obrigatório para |
|---|---|---|
| PostgreSQL gerido | Guardar utilizadores, histórias, conversas e mensagens depois de reiniciar o servidor | Piloto com dados persistentes |
| Chave de um provedor compatível com OpenAI | Gerar respostas reais | IA real; sem ela, permanece o modo demo |
| Ambiente de deploy e domínio | Disponibilizar API e frontend num endereço acessível | Teste com utilizadores externos |
| Grupo de 2 a 5 testadores | Encontrar problemas de utilização e de fluxo | Validar o piloto |

As chaves não devem ser enviadas em mensagens nem gravadas no repositório. Devem ser configuradas como variáveis secretas no ambiente de deploy. As variáveis mínimas são `DATABASE_URL`, `MIAR_ACCESS_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `WEB_ORIGIN` e `VITE_API_URL`.

## 3. Cronograma recomendado

A estimativa assume uma pessoa técnica a trabalhar de forma concentrada e decisões rápidas por parte do produto. O prazo de calendário pode aumentar se houver espera por contas, DNS, aprovação de despesas ou feedback dos testadores.

| Fase | Duração estimada | Resultado |
|---|---:|---|
| Preparação e acessos | 0,5–1 dia | Escopo congelado, contas e variáveis definidas |
| PostgreSQL e IA real | 1–2 dias | Dados persistentes e respostas reais em staging |
| Deploy e validação inicial | 1–2 dias | API e frontend publicados e protegidos |
| Piloto com utilizadores | 3–5 dias | Feedback real e lista de problemas priorizada |
| Correções do piloto | 2–4 dias | Fluxo principal estável para uso privado |
| Endurecimento para produção | 1–2 semanas | Segurança, backups, limites, logs e testes de aceitação |

**Prazo realista para o piloto privado:** aproximadamente **1 a 2 semanas**, desde que as contas e os acessos estejam disponíveis. **Prazo para uma versão pública minimamente responsável:** aproximadamente **3 a 5 semanas**. A visão completa, com anexos reais, voz, câmera e memória avançada, deve ser tratada como uma fase posterior de **6 a 12 semanas ou mais**.

## 4. Plano executável por ordem

### Fase 1 — Congelar o escopo e preparar o ambiente

**Duração:** meio dia a um dia.

A primeira ação é confirmar que o produto inicial é apenas o MIAR Pessoal e que o piloto será privado. Em seguida, deve ser escolhido o ambiente de deploy, preferencialmente o já previsto no projeto, e devem ser criados o PostgreSQL e os serviços da API e do frontend.

Ao terminar esta fase, deve existir uma lista de variáveis de ambiente, um responsável por cada conta e um pequeno grupo de testadores. Nenhuma chave secreta precisa ser partilhada no chat ou no GitHub.

**Pronto quando:** o ambiente existe, os serviços podem ser criados e todos sabem quem fornece cada acesso.

### Fase 2 — Ativar persistência e IA real

**Duração:** um a dois dias.

A API deve ser configurada com `DATABASE_URL` e as migrations devem ser executadas. Depois, deve ser preenchida a chave da IA e selecionado um único modelo. O modo `demo` deve continuar disponível como fallback controlado, mas o piloto deve indicar claramente se está a usar demo ou IA real.

Nesta fase deve ser testado o ciclo de persistência: criar uma história, criar uma conversa, enviar uma mensagem, reiniciar a API e confirmar que tudo continua no banco. O teste não está concluído se funcionar apenas enquanto o processo permanece ligado.

**Pronto quando:** o histórico sobrevive a um reinício da API e uma mensagem recebe resposta do modelo configurado.

### Fase 3 — Publicar o piloto privado

**Duração:** um a dois dias.

A API e o frontend devem ser publicados em staging com HTTPS, CORS limitado ao domínio correto e acesso protegido. O token partilhado existente é aceitável apenas para este piloto pequeno e temporário. O endereço público não deve ser divulgado antes de o login e o fluxo de dados serem testados.

Deve ser executado o smoke test automatizado e, depois, o teste manual no endereço publicado. O teste manual precisa cobrir login, criação de história, criação de conversa, envio de mensagem, atualização da página e leitura do histórico.

**Pronto quando:** o piloto está acessível por um endereço real, mas apenas pessoas autorizadas conseguem entrar e utilizar as rotas de dados.

### Fase 4 — Testar com 2 a 5 pessoas

**Duração:** três a cinco dias corridos.

Cada testador deve receber uma tarefa curta e igual: criar uma história, iniciar uma conversa, enviar três mensagens, sair, voltar e continuar. Devem ser registados os problemas sem tentar corrigi-los no momento. O objetivo é separar erros bloqueadores, confusões de interface e pedidos de funcionalidades novas.

A lista de problemas deve ser classificada assim:

| Prioridade | Definição | Exemplo |
|---|---|---|
| P0 | Impede usar ou pode causar perda/exposição de dados | Não conseguir entrar, histórico de uma pessoa aparecer para outra |
| P1 | Quebra o fluxo principal, mas existe contorno | Mensagem não aparece até atualizar |
| P2 | Incómodo ou melhoria importante | Título pouco claro, estado de carregamento fraco |
| P3 | Funcionalidade futura | Voz, câmera, tema ou integração adicional |

**Pronto quando:** todos os P0 estão resolvidos, os P1 têm plano de correção e existe uma decisão explícita sobre cada pedido P2/P3.

### Fase 5 — Endurecer antes de abrir ao público

**Duração:** uma a duas semanas.

Antes de uso público, o token partilhado deve ser substituído por autenticação individual ou por um provedor de identidade. Devem ser adicionados limites de requisições, logs sem dados sensíveis, backups automáticos, procedimento de restauração, monitorização de erros e testes de aceitação no ambiente publicado.

Também deve ser decidido como serão tratados os dados pessoais: retenção, eliminação de conta, exportação, acesso interno e política de privacidade. Isto é especialmente importante porque histórias e conversas podem conter informação sensível, mesmo que o produto não seja apresentado como um serviço clínico.

**Pronto quando:** existe uma forma de recuperar o sistema, identificar erros, revogar acessos e testar a aplicação depois de cada deploy.

## 5. O que fica explicitamente para depois

Depois de o piloto validar o núcleo, a evolução deve seguir esta ordem: primeiro upload real de anexos com storage e limites; depois autenticação individual e gestão de conta; em seguida memória semântica com consentimento e controlo; por fim voz, câmera, análise de imagem e múltiplos provedores.

A razão é simples: cada uma dessas funcionalidades acrescenta custo, segurança e casos de erro. Implementá-las antes de validar o fluxo principal aumenta a superfície do problema e dificulta saber o que realmente está a falhar.

## 6. Checklist de aceite do piloto

- [ ] O PostgreSQL está criado e acessível apenas pelos serviços necessários.
- [ ] As migrations foram executadas sem erro.
- [ ] `AI_MODE` e o modelo real estão configurados, ou o modo demo está identificado.
- [ ] O frontend publicado consegue falar com a API publicada.
- [ ] O login funciona e uma pessoa sem autorização não consegue consultar dados.
- [ ] Uma história pode ser criada, listada e selecionada.
- [ ] Uma conversa pode ser criada e recebe a saudação inicial.
- [ ] Uma mensagem é gravada e recebe resposta.
- [ ] O histórico continua presente depois de reiniciar a API.
- [ ] Dois utilizadores não conseguem consultar a conversa um do outro.
- [ ] O smoke test passa no ambiente de staging.
- [ ] Os testadores conseguem concluir o fluxo principal sem intervenção técnica.
- [ ] Todos os problemas P0 estão resolvidos.

## 7. Próximas 24 horas

A ação mais útil agora é não programar uma nova funcionalidade. É confirmar estas cinco decisões: **MIAR Pessoal como piloto, plataforma de deploy, PostgreSQL gerido, provedor de IA e grupo de testadores**. Depois disso, a execução pode começar pela configuração do ambiente e pela migração do banco.

Se alguma dessas decisões ainda não estiver disponível, o projeto pode continuar a ser testado localmente no modo memória, mas não deve ser anunciado como sistema persistente nem entregue a utilizadores externos.

## Critério final de sucesso

O piloto será considerado bem-sucedido se, durante vários dias, os testadores conseguirem completar o fluxo principal, os dados permanecerem disponíveis após reinícios, não houver exposição entre utilizadores e a equipa conseguir identificar e corrigir problemas sem depender de intervenção manual a cada sessão.
