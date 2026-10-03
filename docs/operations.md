# Operação e observabilidade

## Health

`GET /health` reporta:

- status;
- versão;
- estado do banco;
- timestamp.

Quando banco está configurado mas indisponível, retorna 503 com estado degradado sem revelar credenciais.

## Logging

A API possui request ID e logger. Dados sensíveis não devem ser incluídos em logs.

## Shutdown

O servidor possui encerramento gracioso para SIGINT/SIGTERM e timeout limitado para fechar HTTP e banco.

## Diagnóstico de sync

Verifique, nesta ordem:

1. `VITE_API_MODE=live`;
2. conectividade;
3. capability presente/recuperável;
4. tamanho da outbox;
5. conflitos locais;
6. resposta de `/sync/push`;
7. cursor de `/sync/pull`;
8. banco/PostGIS.

## Rollback

Para mudanças de código: preferir revert/forward fix em Git.

Para banco: utilizar migration reversível/forward fix validado. Não usar reset destrutivo em produção.

## Backups

Neon é tratado como sincronização/backup remoto; a operação local continua independente durante indisponibilidade de rede.
