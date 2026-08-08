# MIAR-ARIA

Este repositório contém o projeto MIAR AI com interface Electron e suporte a IA local.

## Passos para baixar e executar

1. Faça o download do repositório como ZIP ou clone com Git:
   ```bash
   git clone https://github.com/miarmaakyu/MIAR-ARIA.git
   ```
2. Abra a pasta do projeto:
   ```bash
   cd MIAR-ARIA
   ```
3. Instale o pnpm se ainda não tiver:
   ```bash
   corepack enable
   ```
4. Instale as dependências do workspace:
   ```bash
   pnpm install
   ```
5. Entre na pasta do app:
   ```bash
   cd products/miar-ai
   ```
6. Inicie o app:
   ```bash
   pnpm start
   ```

## Observações

- O app é uma aplicação desktop Electron, não um site web.
- Para abrir a interface, é preciso rodar no seu computador com ambiente gráfico.
- Se você estiver usando apenas o container remoto, o app pode iniciar em background, mas não aparecerá como janela visível aqui.

## Alternativa no Windows

- Abra `products/miar-ai/start.bat`
