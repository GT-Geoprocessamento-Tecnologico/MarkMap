# Handoff de continuidade

Atualizado em 2026-10-03.

## Estado atual

- HEAD de código validado: `dd35fcf`.
- Branch remota: somente `main`.
- PRs abertas: 0.
- Issues abertas: 0.
- Arquitetura: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência instalável principal: **PWA**.
- Capacitor permanece somente como empacotamento já existente para Android/iOS; WebNative permanece fora do plano.
- Operação: offline-first; IndexedDB é a fonte operacional no dispositivo.
- Documentação oficial: `docs/`.
- Nenhuma migration de production, deploy público, publicação, release/tag ou rotação de secrets foi executada nesta estabilização.

## Gates validados

No HEAD `dd35fcf`:

- Lint: **verde**;
- Typecheck: **verde**;
- Unit Tests: **verde**;
- Build: **verde**;
- E2E desktop/Android mobile: **verde**;
- E2E iOS/WebKit: **verde**;
- PostGIS Integration: **verde**.

Builds mobile do último commit funcional `57b7065`:

- Android APK: **verde**;
- iOS App: **verde**.

Os commits posteriores até `dd35fcf` alteraram somente testes/formatação e não código do app mobile.

## Correções P0 concluídas

### Rate limit

- `workspace/provision` e `workspace/recover` usam limiter distribuído no PostgreSQL;
- usa buckets por identidade técnica + global;
- não confia diretamente em `x-forwarded-for`;
- serialização entre instâncias é garantida por transação + advisory lock;
- tentativas permitidas são registradas em `audit_events`;
- teste concorrente real no PostGIS ficou verde;
- resposta de bloqueio usa HTTP 429 + código `RATE_LIMITED`.

### Storage remoto

- presign exige capability de workspace;
- chave remota é automaticamente prefixada por `workspaceId`;
- path traversal continua bloqueado;
- PUT/GET presigned usam expiração curta;
- sem configuração S3 válida, storage continua fail-closed com 503;
- testes cobrem ausência de capability, namespace e path traversal.

### Rotas de domínio

- `projects/layers/features` voltaram a ficar desabilitadas em production;
- production mantém o caminho isolado por workspace via sync;
- risco de exposição cruzada criado pela habilitação direta em production foi removido.

### PATCH feature

- `PATCH /features/:id` usa `updateFeatureSchema`;
- mantém optimistic concurrency por `version`;
- preserva erro de conflito da camada DB;
- rota permanece disponível apenas fora de production junto às demais rotas diretas.

### PWA

- zoom do navegador voltou a ser permitido;
- `@vitejs/plugin-basic-ssl` foi restaurado no servidor de desenvolvimento;
- preview Playwright continua HTTP explicitamente para teste local controlado;
- manifest, service worker e update prompt permanecem preservados.

## Estado funcional resumido

### FUNCIONA

- IndexedDB/local-first;
- outbox, acknowledgements e conflitos;
- sync push/pull;
- capability por workspace;
- PostGIS/SRID 4674;
- MapLibre/Terra Draw;
- GeoPDF georreferenciado;
- manifest/service worker/update prompt;
- rate limiting distribuído de provision/recover;
- storage presign workspace-scoped quando S3 está configurado;
- lint/typecheck/unit/build/E2E/PostGIS;
- builds debug Android/iOS.

### PARCIAL / PENDENTE

- validação automatizada completa de installability/upgrade PWA preservando IndexedDB/outbox;
- E2E de sync/conflict com dois contextos isolados;
- calibração automática de PDF sem georreferenciamento válido;
- Lighthouse/PWA/a11y no CI;
- dependency/secret/security scans adicionais;
- política pública de privacidade;
- plano de deploy, release notes e suporte/rollback;
- smoke contra production continua condicionado a autorização explícita.

## Fora do backlog automatizável

- testes físicos Android/iOS;
- signing/provisioning real;
- publicação em lojas;
- ações em production que exigem autorização explícita.

## Próximo item operacional executável

**P0 — Adicionar validação automatizada da PWA: manifest/installability, app shell offline e upgrade preservando IndexedDB/outbox.**

Depois:

1. E2E de sync/conflict com dois contextos isolados;
2. calibração automática GeoPDF sem georreferenciamento válido;
3. Lighthouse/a11y + security/dependency/secret scans;
4. política de privacidade;
5. preparação de deploy/release/rollback.
