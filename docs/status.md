# Status técnico

Snapshot documental: HEAD `d6d8bf0` auditado em 2026-10-03.

| Área | Estado | Evidência/observação |
|---|---|---|
| Build | FUNCIONA | workflow verde no HEAD |
| E2E | FUNCIONA | workflow verde no HEAD |
| PostGIS Integration | FUNCIONA | workflow verde no HEAD |
| Android debug build | FUNCIONA | workflow verde no HEAD |
| iOS debug build | FUNCIONA | workflow verde no HEAD |
| Lint | QUEBRADO | CI vermelho em `api#lint` |
| Typecheck | QUEBRADO | CI vermelho em `api#typecheck` |
| Unit Tests | QUEBRADO | 1 teste API falhando |
| React/Vite/PWA base | PARCIAL | estrutura funciona; viewport bloqueia zoom e dev HTTPS foi removido |
| IndexedDB local-first | FUNCIONA | stores + LocalRepository |
| Outbox/acks/conflicts | FUNCIONA | implementação/testes existentes |
| Sync push/pull | FUNCIONA | contratos + API + integração PostGIS |
| Isolamento do sync por workspace | FUNCIONA | capability middleware no `/sync/*` |
| Rotas diretas de domínio em production | QUEBRADO / RISCO | habilitadas sem capability e queries sem filtro workspace |
| MapLibre/Terra Draw | FUNCIONA | núcleo do admin |
| PostGIS/SRID 4674 | FUNCIONA | schema e integração |
| GeoPDF georreferenciado | FUNCIONA | módulos e testes |
| Storage remoto | QUEBRADO | presign espera capability, mas rota não monta middleware; valid key retorna 401 |
| Rate limit provision/recover | QUEBRADO / PARCIAL | não compila; in-memory; não atende múltiplas instâncias |
| PATCH feature live | QUEBRADO | `updateFeatureSchema` ausente no arquivo; typecheck falha |
| Notifications SSE | PARCIAL | eventos demonstrativos |
| Privacy policy pública | NÃO IMPLEMENTADO | requisito de release |
| E2E de duas instalações | NÃO IMPLEMENTADO | backlog |
| Auto-calibração PDF sem georef | NÃO IMPLEMENTADO | backlog |
| Lighthouse/a11y/security scans | NÃO IMPLEMENTADO | backlog |
| Deploy web produção | NÃO IMPLEMENTADO | domínio/provedor não definidos |
| Signing/publicação mobile | FORA DO BACKLOG AUTOMATIZÁVEL | requer credenciais/ação externa |

## Evidência do CI atual

No workflow CI do HEAD `d6d8bf0`:

- lint falha por erros de imports/formatação/strict boolean no rate-limit/storage;
- typecheck falha por:
  - import de tipo incorreto em `rate-limit.ts`;
  - uso de `c.req.ip` inexistente;
  - `updateFeatureSchema` inexistente no escopo;
  - tipo de `capabilityWorkspaceId` ausente nas rotas de storage;
- unit test falha em storage porque o teste esperava 503 e a nova implementação retorna 401 sem capability.

Nenhuma linha “FUNCIONA” substitui validação física quando a funcionalidade depende do dispositivo.
