# Handoff de continuidade

Atualizado em 2026-10-03.

## Estado atual

- HEAD validado: `8aed47d`.
- Branch remota: somente `main`.
- PRs abertas: 0.
- Issues abertas: 0.
- Arquitetura: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência instalável principal: **PWA**.
- Capacitor permanece somente como empacotamento opcional já existente para Android/iOS; WebNative permanece fora do plano.
- Operação: offline-first; IndexedDB é a fonte operacional no dispositivo.
- Documentação oficial: `docs/`.
- Nenhuma migration de production, deploy público, publicação, release/tag ou rotação de secrets foi executada.

## Gates validados

No HEAD `8aed47d`:

- Lint: **verde**;
- Typecheck: **verde**;
- Unit Tests: **verde**;
- Build: **verde**;
- PostGIS Integration: **verde**;
- E2E desktop/Android mobile: **verde**;
- E2E iOS/WebKit: **verde**;
- E2E de duas instalações: **verde**;
- Android APK: **verde**;
- iOS App: **verde**.

## P0/P1 automatizáveis concluídos nesta fase

### PWA

- contrato automatizado de manifest/installability;
- validação dos ícones 192/512, normais e maskable;
- service worker instalado, ativo e controlando a página;
- app shell validado em reload totalmente offline;
- viewport mantém zoom disponível;
- migração IndexedDB v1 → v2 validada em Chromium;
- workspace, entidade e outbox sobrevivem ao upgrade;
- criação dos stores/índices novos é comprovada sem apagar dados locais.

### Sync entre duas instalações

- dois contextos Chromium isolados usam o mesmo workspace;
- capability é provisionada/recuperada;
- retry após resposta 500 com operação já persistida não duplica alteração;
- idempotência por `operationId` é comprovada;
- pull replica o projeto para a segunda instalação;
- edições concorrentes geram `VERSION_CONFLICT`;
- conflito fica explícito na UI e é resolvido sem sobrescrita silenciosa.

### Segurança estabilizada anteriormente

- rate limit distribuído no PostgreSQL para provision/recover;
- storage presign exige capability e namespace por workspace;
- rotas diretas de domínio permanecem desabilitadas em production;
- PATCH feature valida schema/version fora de production;
- CORS, request ID, body limit, headers e logs estruturados permanecem ativos.

## Estado funcional resumido

### FUNCIONA

- IndexedDB/local-first;
- outbox, acknowledgements e conflitos;
- PWA manifest/service worker/offline shell;
- upgrade PWA preservando IndexedDB/outbox em teste automatizado;
- sync push/pull;
- sync entre dois contextos isolados com retry/idempotência/conflito;
- capability por workspace;
- rate limit distribuído;
- storage workspace-scoped quando configurado;
- PostGIS/SRID 4674;
- MapLibre/Terra Draw;
- GeoPDF georreferenciado;
- lint/typecheck/unit/build/E2E/PostGIS;
- builds debug Android/iOS.

### PARCIAL / PENDENTE

- calibração automática de PDF sem georreferenciamento válido;
- Lighthouse/PWA/a11y no CI;
- dependency/secret/security scans adicionais;
- política pública de privacidade;
- plano final de deploy/release/suporte;
- smoke contra production condicionado a autorização explícita.

## Fora do backlog automatizável

- testes físicos Android/iOS;
- instalação PWA física/A2HS;
- signing/provisioning real;
- publicação em lojas;
- ações em production que exigem autorização explícita.

## Próximo item operacional executável

**P0 — Implementar calibração automática de PDF/GeoPDF sem georreferenciamento válido, com aceitação automática somente sob limiar de confiança/erro e fallback manual preservado.**

Depois:

1. Lighthouse/PWA/a11y + security/dependency/secret scans;
2. política de privacidade;
3. preparação de deploy/release/rollback;
4. auditoria final de cliente HTTP legado e textos obsoletos.
