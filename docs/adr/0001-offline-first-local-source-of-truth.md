# ADR-0001 — Offline-first com estado operacional local

**Status:** Accepted  
**Data:** 2026-10-01

## Contexto

O GeoNexo é usado em campo, frequentemente sem conectividade contínua. Bloquear criação/edição aguardando API inviabiliza o produto.

## Decisão

O estado operacional de campo é salvo localmente primeiro. IndexedDB/local repository mantém entidades, metadados e outbox. A UI confirma sucesso após persistência local válida. A sincronização remota ocorre depois.

## Alternativas consideradas

- API/Neon como fonte primária de escrita: rejeitada para uso offline.
- Segunda arquitetura offline paralela: rejeitada por complexidade e duplicação.

## Consequências

- app precisa lidar com retry, conflitos e versões;
- update do app não pode apagar storage/outbox;
- testes devem cobrir reload/force-stop/reconnect;
- Neon pode ficar indisponível sem impedir trabalho local.
