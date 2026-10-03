# Changelog documental

Este arquivo registra mudanças relevantes de arquitetura, documentação e organização. Não substitui tags/releases oficiais.

## 2026-10-03

### Qualidade e PWA

- adicionada validação automatizada de manifest, ícones e installability;
- service worker/app shell validados em reload totalmente offline;
- upgrade IndexedDB v1→v2 validado preservando workspace, entidade e outbox;
- zoom/acessibilidade do viewport e HTTPS de desenvolvimento permanecem preservados.

### Sync

- adicionado E2E com duas instalações Chromium isoladas;
- cobertos retry após falha com commit, idempotência, pull e conflito de versão;
- resolução explícita de conflito validada sem sobrescrita silenciosa.

### Segurança

- rate limit de provision/recover usa PostgreSQL com advisory lock transacional;
- storage presign exige capability e namespace por workspace;
- rotas diretas de domínio permanecem desabilitadas em production;
- contrato/frontend tratam `RATE_LIMITED`.

### Documentação e limpeza

- documentação centralizada em `docs/`;
- estado implementado separado de itens parciais/pendentes;
- removidos artefatos/documentos históricos comprovadamente obsoletos em auditorias anteriores;
- Handoff, status, testes, segurança e checklist de release mantidos alinhados ao HEAD.
