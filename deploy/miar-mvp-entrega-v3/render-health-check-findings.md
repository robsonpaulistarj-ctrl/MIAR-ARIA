# Fontes oficiais — Render health checks

Fonte: https://render.com/docs/health-checks

O Render envia verificações periódicas a web services e private services para confirmar que as instâncias estão prontas para receber tráfego. Por defeito, a verificação é TCP para uma porta aberta; web services podem configurar um health check HTTP GET através de `healthCheckPath`.

Para health checks HTTP, uma resposta 2xx ou 3xx dentro de cinco segundos é considerada sucesso; qualquer 4xx/5xx ou ausência de resposta falha. Num novo deploy, o Render só começa a encaminhar tráfego quando todas as novas instâncias passam simultaneamente. Se isso não acontecer em 15 minutos, o deploy é cancelado e as instâncias anteriores continuam a receber tráfego.

Implicação para o MIAR: o endpoint configurado deve estar disponível rapidamente, o processo deve escutar a porta definida por `PORT`/`10000`, e o `startCommand` não deve ficar bloqueado por migrations, preflight incompleto ou ligação externa durante o arranque. O `/api/healthz` deve ser testado directamente no domínio da API.
