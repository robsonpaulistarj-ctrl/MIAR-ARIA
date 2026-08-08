# Atualização automática — MIAR EDITA

Este app usa electron-updater para verificar atualizações automaticamente.

## Como funciona
- Ao abrir o app instalado, ele verifica atualizações após alguns segundos.
- Se houver nova versão, o app baixa e instala automaticamente ao fechar.

## Para funcionar corretamente
- O projeto precisa ser publicado em GitHub Releases.
- O instalador deve ser gerado com electron-builder.
- O repositório deve ter as configurações de publish corretas.
