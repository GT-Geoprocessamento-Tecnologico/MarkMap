# Handoff de continuidade

Atualizado em 2026-10-03.

## Estado atual

- Branch remota: somente `main`.
- Arquitetura: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência instalável principal: **PWA**.
- Capacitor permanece apenas como empacotamento já existente para Android/iOS; **WebNative foi removido do plano**.
- Operação: offline-first; IndexedDB é a fonte operacional no dispositivo.
- Documentação oficial: `docs/`.
- Migrations destrutivas, deploy público, publicação em loja, release/tag e rotação de secrets continuam exigindo autorização explícita.

## Estado funcional resumido

### FUNCIONA

- persistência local IndexedDB;
- outbox, acknowledgements e conflitos;
- sync push/pull;
- workspace capability;
- PostGIS/SRID 4674;
- MapLibre/Terra Draw;
- GeoPDF georreferenciado;
- PWA com manifest, service worker e update prompt;
- builds debug Android/iOS já existentes;
- CI de lint/typecheck/unit/build/E2E/PostGIS.

### PARCIAL

- hardening automatizado de instalação/upgrade da PWA;
- storage remoto;
- notificações SSE;
- smoke de sync contra production depende de autorização explícita.

### Gaps conhecidos executáveis por software

- rate limit/abuse protection em `workspace/provision` e `workspace/recover`;
- autorização por workspace e implementação funcional do storage remoto;
- teste automatizado multi-instalação/contexto para sync/conflict;
- calibração automática de PDF sem georreferenciamento válido;
- limpeza do cliente HTTP legado e do gap `PATCH /features/:id` se ainda houver consumidor;
- texto/comentários obsoletos sobre backend/sync;
- política pública de privacidade;
- Lighthouse/PWA/a11y e security scan no pipeline;
- preparação de deploy web, release notes e rollback, sem executar deploy/release sem autorização.

## Fora do backlog automatizável

- testes físicos em Android/iPhone/iPad;
- publicação em lojas;
- signing/provisioning com credenciais reais;
- qualquer ação destrutiva ou mudança em production sem autorização.

## Próximo item operacional executável

**P0 — Implementar rate limiting/abuse protection em `/workspace/provision` e `/workspace/recover`, com testes automatizados e comportamento compatível com múltiplas instâncias.**

Depois:

1. storage remoto com autorização por workspace;
2. hardening/validação automatizada da PWA e persistência de IndexedDB/outbox em upgrade;
3. teste automatizado de sync/conflict entre dois contextos isolados;
4. calibração automática de PDF/GeoPDF sem georreferenciamento válido;
5. limpeza de contratos/código legado e documentação;
6. privacidade, release notes, deploy plan e rollback.
