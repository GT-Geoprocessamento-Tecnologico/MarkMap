# Status técnico

Snapshot documental: HEAD auditado em 2026-10-03.

| Área | Estado | Evidência/observação |
|---|---|---|
| React/Vite/PWA | FUNCIONA | build e E2E existentes |
| IndexedDB local-first | FUNCIONA | stores + LocalRepository |
| Outbox/acks/conflicts | FUNCIONA | implementação e testes |
| Sync push/pull | FUNCIONA | contratos + API + integração PostGIS |
| Isolamento por workspace | FUNCIONA | capability + schema/workspace |
| MapLibre/Terra Draw | FUNCIONA | núcleo do admin |
| PostGIS/SRID 4674 | FUNCIONA | schema e testes |
| GeoPDF georreferenciado | FUNCIONA | módulos e testes |
| Android debug build | FUNCIONA | workflow |
| iOS debug build | FUNCIONA | workflow |
| Teste físico Android | NÃO IMPLEMENTADO/VALIDADO | requer aparelho real |
| Teste físico iOS | NÃO IMPLEMENTADO/VALIDADO | requer aparelho real |
| Storage remoto | PARCIAL | presign retorna 503 |
| Domain API em produção | PARCIAL | rotas projects/layers/features desabilitadas em production |
| PATCH feature live | QUEBRADO/GAP | cliente chama PATCH, rota atual não implementa PATCH |
| Notifications SSE | PARCIAL | eventos demonstrativos |
| Rate limit provision/recover | NÃO IMPLEMENTADO | gap de segurança |
| Privacy policy pública | NÃO IMPLEMENTADO | requisito de release |
| Auto-calibração PDF sem georef | NÃO IMPLEMENTADO | backlog |
| Deploy web produção | NÃO IMPLEMENTADO | provedor/domínio não definidos |
| Signing/publicação mobile | NÃO IMPLEMENTADO | requer autorização e credenciais |

Nenhuma linha “FUNCIONA” substitui validação física quando a funcionalidade depende do dispositivo.
