# Status técnico

Snapshot documental: HEAD `8aed47d` validado em 2026-10-03.

| Área | Estado | Evidência/observação |
|---|---|---|
| Lint | FUNCIONA | CI verde no HEAD |
| Typecheck | FUNCIONA | CI verde no HEAD |
| Unit Tests | FUNCIONA | CI verde no HEAD |
| Build | FUNCIONA | workflow verde no HEAD |
| PostGIS Integration | FUNCIONA | workflow verde no HEAD |
| E2E desktop/Android | FUNCIONA | Playwright verde no HEAD |
| E2E iOS/WebKit | FUNCIONA | Playwright verde no HEAD |
| E2E duas instalações | FUNCIONA | retry, idempotência, pull e VERSION_CONFLICT verdes |
| Android debug build | FUNCIONA | workflow verde no HEAD |
| iOS debug build | FUNCIONA | workflow verde no HEAD |
| PWA installability | FUNCIONA | manifest/ícones/SW validados automaticamente |
| App shell offline | FUNCIONA | reload totalmente offline em Chromium |
| Upgrade IndexedDB/outbox | FUNCIONA | v1→v2 preserva workspace, entidade e outbox |
| IndexedDB local-first | FUNCIONA | LocalRepository é a fonte operacional |
| Outbox/acks/conflicts | FUNCIONA | testes unitários + E2E sync |
| Sync push/pull | FUNCIONA | contratos + API + PostGIS |
| Isolamento do sync por workspace | FUNCIONA | capability no `/sync/*` |
| Rate limit provision/recover | FUNCIONA | PostgreSQL + transaction advisory lock |
| Storage remoto | FUNCIONA CONDICIONAL | capability + prefixo workspace; 503 sem config S3 |
| Rotas diretas de domínio em production | SEGURO / DESABILITADO | guard de production restaurado |
| PATCH feature | FUNCIONA FORA DE PRODUCTION | optimistic concurrency por version |
| MapLibre/Terra Draw | FUNCIONA | núcleo cartográfico |
| PostGIS/SRID 4674 | FUNCIONA | schema + integração |
| GeoPDF georreferenciado | FUNCIONA | módulos/testes existentes |
| Auto-calibração PDF sem georef | PARCIAL | fallback manual existe; automação robusta ainda pendente |
| Lighthouse/a11y/security scans | NÃO IMPLEMENTADO | próximo backlog após GeoPDF |
| Privacy policy pública | NÃO IMPLEMENTADO | requisito de release |
| Deploy web produção | NÃO IMPLEMENTADO | domínio/provedor não definidos |
| Signing/publicação mobile | FORA DO BACKLOG AUTOMATIZÁVEL | credenciais/ação externa |

Nenhuma ação destrutiva ou alteração de production foi executada nesta fase.
