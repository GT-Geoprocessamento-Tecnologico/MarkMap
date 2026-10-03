# ADR-0002 — API Hono como fronteira para Neon/PostGIS

**Status:** Accepted

## Contexto

Credenciais privilegiadas do banco não devem chegar ao navegador e o isolamento por workspace precisa ser aplicado no servidor.

## Decisão

O fluxo remoto é app → API Hono → PostgreSQL/Neon + PostGIS. Contratos Zod são compartilhados e a sincronização usa capability por workspace.

## Consequências

- connection strings ficam apenas server-side;
- CORS/validação/headers/logging são tratados pela API;
- sync push/pull passa pela capability;
- schema remoto permanece PostgreSQL/PostGIS;
- APIs novas devem preservar isolamento por workspace.
