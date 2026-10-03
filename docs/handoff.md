# Handoff de continuidade

Atualizado em 2026-10-03.

## Estado atual

- Branch remota: somente `main`.
- Arquitetura: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox + Capacitor.
- Operação: offline-first; IndexedDB é a fonte operacional no dispositivo.
- Documentação oficial: `docs/`.
- Materiais históricos/configurações de agentes foram removidos da árvore atual.
- Migrations destrutivas, deploy público, publicação em loja, release/tag e rotação de secrets continuam exigindo autorização explícita.

## O que foi consolidado nesta auditoria

- README raiz reduzido a entrada objetiva.
- Documentação técnica e operacional preenchida com base no código real.
- Placeholders e afirmações não comprovadas removidos.
- Workflow temporário de limpeza de branches removido após cumprir sua função.
- README E2E obsoleto removido.
- Dependências/licenças de terceiros preservadas.

## Estado funcional resumido

### FUNCIONA

- persistência local IndexedDB;
- outbox, acknowledgements e conflitos;
- sync push/pull;
- workspace capability;
- PostGIS/SRID 4674;
- MapLibre/Terra Draw;
- GeoPDF georreferenciado;
- builds debug Android/iOS;
- CI de lint/typecheck/unit/build/E2E/PostGIS.

### PARCIAL

- storage remoto;
- notificações SSE;
- validação física mobile/PWA.

### Gaps conhecidos

- rate limit em workspace provision/recover;
- autorização workspace-scoped para storage;
- política pública de privacidade;
- calibração automática de PDF sem georreferenciamento válido;
- signing/publicação mobile;
- deploy web de produção.

## Próximo item operacional

Instalar o APK debug já gerado em Android físico e validar MapLibre, GPS, criação/edição local, force-stop e reabertura totalmente offline.

Não marcar esse item como concluído por emulação ou CI.
