# Status técnico

Snapshot documental: HEAD `dd35fcf` validado em 2026-10-03.

| Área | Estado | Evidência/observação |
|---|---|---|
| Lint | FUNCIONA | CI verde no HEAD |
| Typecheck | FUNCIONA | CI verde no HEAD |
| Unit Tests | FUNCIONA | CI verde no HEAD |
| Build | FUNCIONA | workflow verde no HEAD |
| E2E desktop/Android | FUNCIONA | Playwright verde no HEAD |
| E2E iOS/WebKit | FUNCIONA | Playwright verde no HEAD |
| PostGIS Integration | FUNCIONA | workflow verde no HEAD |
| Android debug build | FUNCIONA | verde em `57b7065`; commits posteriores só alteraram testes/formatação |
| iOS debug build | FUNCIONA | verde em `57b7065`; commits posteriores só alteraram testes/formatação |
| React/Vite/PWA base | FUNCIONA | zoom restaurado, HTTPS dev restaurado, build/E2E verdes |
| IndexedDB local-first | FUNCIONA | stores + LocalRepository |
| Outbox/acks/conflicts | FUNCIONA | implementação/testes existentes |
| Sync push/pull | FUNCIONA | contratos + API + integração PostGIS |
| Isolamento do sync por workspace | FUNCIONA | capability middleware no `/sync/*` |
| Rotas diretas de domínio em production | SEGURO / DESABILITADO | guard de production restaurado |
| MapLibre/Terra Draw | FUNCIONA | núcleo do admin |
| PostGIS/SRID 4674 | FUNCIONA | schema + integração |
| GeoPDF georreferenciado | FUNCIONA | módulos/testes existentes |
| Storage remoto | FUNCIONA CONDICIONAL | capability obrigatória + namespace por workspace; 503 se S3 não configurado |
| Rate limit provision/recover | FUNCIONA | PostgreSQL + transaction advisory lock; teste concorrente verde |
| PATCH feature | FUNCIONA FORA DE PRODUCTION | schema/version corrigidos; rotas diretas seguem desabilitadas em production |
| Notifications SSE | PARCIAL | eventos demonstrativos |
| Upgrade PWA preservando dados | PENDENTE | precisa E2E automatizado dedicado |
| E2E de duas instalações | NÃO IMPLEMENTADO | backlog |
| Auto-calibração PDF sem georef | NÃO IMPLEMENTADO | backlog |
| Lighthouse/a11y/security scans | NÃO IMPLEMENTADO | backlog |
| Privacy policy pública | NÃO IMPLEMENTADO | requisito de release |
| Deploy web produção | NÃO IMPLEMENTADO | domínio/provedor não definidos |
| Signing/publicação mobile | FORA DO BACKLOG AUTOMATIZÁVEL | depende de credenciais/ação externa |

## Correções desta estabilização

- substituído limiter in-memory por limiter distribuído no PostgreSQL;
- corrigida corrida concorrente com transação + advisory lock;
- storage passou a resolver capability e prefixar objetos por workspace;
- rotas diretas de domínio voltaram a ser bloqueadas em production;
- PATCH feature voltou a compilar e validar optimistic concurrency;
- contrato recebeu `RATE_LIMITED` e frontend recebeu mensagem correspondente;
- viewport deixou de bloquear zoom;
- HTTPS de desenvolvimento Vite foi restaurado.

Nenhuma ação destrutiva ou mudança em production foi executada.
