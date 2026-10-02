# ADR-0002 — Neon/PostGIS como backend de sincronização

**Status:** Accepted  
**Data:** 2026-10-01

## Contexto

O GeoNexo precisa sincronizar geometrias, permitir recuperação/compartilhamento futuro e executar consultas espaciais.

## Decisão

Usar Neon PostgreSQL + PostGIS atrás da API Hono. O navegador não recebe credencial privilegiada do banco. Operações locais são sincronizadas por protocolo push/pull com idempotência, cursor, tombstones, versionamento e isolamento por workspace.

Geometrias persistidas no domínio usam EPSG:4674 / SIRGAS 2000.

## Alternativas consideradas

- acesso direto do browser ao banco: rejeitado por segurança;
- banco remoto como requisito de campo: rejeitado pelo princípio offline-first;
- banco espacial diferente: não justificado no estado atual.

## Consequências

- API é fronteira de segurança;
- migrations remotas exigem disciplina/testes;
- sync deve materializar dados nas tabelas de domínio e não somente no log;
- arquivos grandes ficam fora das tabelas de domínio.
