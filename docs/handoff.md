# Handoff de continuidade

Atualizado em 2026-10-03.

## Estado atual

- HEAD auditado: `d6d8bf0`.
- Branch remota: somente `main`.
- PRs abertas: 0.
- Issues abertas: 0.
- Arquitetura: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência instalável principal: **PWA**.
- Capacitor permanece apenas como empacotamento já existente para Android/iOS; **WebNative foi removido do plano**.
- Operação: offline-first; IndexedDB é a fonte operacional no dispositivo.
- Documentação oficial: `docs/`.
- Migrations destrutivas, deploy público, publicação em loja, release/tag e rotação de secrets continuam exigindo autorização explícita.

## Auditoria do HEAD atual

### Gates

No HEAD `d6d8bf0`:

- Build: **verde**;
- E2E: **verde**;
- PostGIS Integration: **verde**;
- Android APK: **verde**;
- iOS App: **verde**;
- Lint: **vermelho**;
- Typecheck: **vermelho**;
- Unit Tests: **vermelho**.

O HEAD atual não pode ser tratado como Release Candidate enquanto os três gates vermelhos não forem restaurados.

### Mudanças recentes auditadas

Foram adicionadas/alteradas recentemente:

- rate limiting para `workspace/provision` e `workspace/recover`;
- presign S3;
- `PATCH /features/:id`;
- rotas de projects/layers/features habilitadas também em production;
- ajustes de PWA/manifest/iOS icon;
- remoção do Basic SSL do Vite dev server.

## Estado funcional resumido

### FUNCIONA

- persistência local IndexedDB;
- outbox, acknowledgements e conflitos;
- sync push/pull existente;
- workspace capability no fluxo de sync;
- PostGIS/SRID 4674;
- MapLibre/Terra Draw;
- GeoPDF georreferenciado;
- service worker, manifest e update prompt;
- build web;
- E2E;
- integração PostGIS;
- builds debug Android/iOS.

### PARCIAL

- PWA: estrutura existe, mas houve regressão de acessibilidade no viewport e o dev server perdeu HTTPS local;
- notificações SSE;
- smoke de sync contra production depende de autorização explícita;
- release checklist/documentação ainda precisam refletir o HEAD atual.

### QUEBRADO / BLOQUEADOR

- CI principal: lint, typecheck e unit tests vermelhos;
- rate limiter atual não compila e usa store em memória, portanto não atende múltiplas instâncias;
- rate limiter confia diretamente em `x-forwarded-for` sem modelo de proxy confiável;
- storage presign tenta ler `capabilityWorkspaceId`, mas as rotas `/storage` não usam `capabilityMiddleware`; chave válida retorna 401 e o código não passa typecheck;
- `PATCH /features/:id` referencia `updateFeatureSchema` sem import/definição no arquivo e não passa typecheck;
- rotas de domínio foram habilitadas em production sem capability middleware;
- queries de projects/layers/features não são filtradas por workspace nas rotas diretas, criando risco de leitura cruzada entre workspaces;
- POST de domínio direto não injeta `workspaceId` mesmo que a camada DB exija esse campo, tornando criação direta inconsistente;
- teste de storage está desatualizado em relação ao comportamento novo e falha (esperava 503; recebeu 401).

### NÃO IMPLEMENTADO / PENDENTE

- E2E automatizado com duas instalações/contextos para sync/conflict;
- calibração automática de PDF sem georreferenciamento válido;
- política pública de privacidade aprovada;
- Lighthouse/PWA/a11y CI;
- security/dependency/secret scans;
- plano de deploy web;
- release notes/versão candidata;
- suporte/rollback final.

## Fora do backlog automatizável

- testes físicos em Android/iPhone/iPad;
- publicação em lojas;
- signing/provisioning com credenciais reais;
- qualquer ação destrutiva ou mudança em production sem autorização.

## Próximo item operacional executável

**P0 — Restaurar os gates do HEAD e corrigir as regressões de segurança das mudanças recentes antes de implementar novas funcionalidades.**

Ordem:

1. corrigir Typecheck/Lint/Unit;
2. proteger ou desabilitar novamente as rotas diretas de domínio em production até existir isolamento por workspace;
3. refazer rate limiting para solução compatível com múltiplas instâncias e proxy confiável;
4. montar capability middleware no storage e adicionar testes cross-workspace;
5. corrigir/validar `PATCH /features/:id` ou removê-lo se não houver consumidor real;
6. corrigir regressão de acessibilidade do viewport e definir estratégia HTTPS para desenvolvimento PWA;
7. só depois retomar hardening PWA, sync multi-contexto, GeoPDF e release.
