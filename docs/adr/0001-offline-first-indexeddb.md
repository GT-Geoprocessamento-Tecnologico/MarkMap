# ADR-0001 — Offline-first com IndexedDB

**Status:** Accepted

## Contexto

O usuário principal trabalha em campo e pode ficar sem conectividade. A operação não pode depender do banco remoto.

## Decisão

IndexedDB/local repository é a fonte operacional no dispositivo. Mutações são registradas em outbox durável e sincronizadas posteriormente.

## Consequências

- criação/edição precisa funcionar offline;
- retry deve ser idempotente;
- conflitos não podem ser sobrescritos silenciosamente;
- atualizações da aplicação devem preservar dados locais;
- Neon/PostGIS não é requisito para continuar o trabalho de campo.
