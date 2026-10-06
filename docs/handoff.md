# Handoff de continuidade

Atualizado em 2026-10-05.

## Estado atual

- Baseline funcional anterior validado: `cc2331d`.
- HEAD funcional do design integrado: `9b4fb391` (refino visual do site e aplicação operacional; documentação atualizada em seguida).
- Branch remota esperada: somente `main`.
- Arquitetura preservada: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência principal instalável: PWA.
- Capacitor permanece somente como empacotamento opcional.
- Nenhum deploy, release/tag, migration de production, publicação em loja ou rotação de secrets foi executado.

## Concluído com evidência

- local-first IndexedDB/outbox;
- PWA installability, service worker, cold offline e upgrade de IndexedDB;
- sync push/pull + dois contextos isolados com reconexão real, retry, idempotência e conflito explícito;
- PostGIS/SRID 4674;
- rate limit distribuído;
- storage workspace-scoped;
- GeoPDF válido + auto-calibração de grade geográfica/UTM com confidence gate e fallback manual;
- lint/typecheck/unit/build/E2E/PostGIS;
- dependency audit, secret scan e Lighthouse/a11y;
- builds debug Android/iOS.

## Bloqueios externos/release

- política pública de privacidade precisa de identidade/contato/retenção/provedores reais e revisão jurídica;
- domínio/provedor de produção não definido;
- smoke production exige autorização;
- testes físicos/PWA instalada;
- signing/publicação mobile.

## Próximo item executável sem ação externa

Não há P0 funcional automatizável conhecido aberto após esta consolidação. O próximo trabalho interno é manutenção/otimização não bloqueante (ex.: tamanho de bundle) ou correções que surgirem dos testes.

## Próximo passo de release

Obter os dados/autorizações externos acima e executar o preflight de `docs/release-runbook.md`.


## Rebranding MarkMap — 2026-10-05

- marca pública alterada de GeoNexo para **MarkMap — Planejamento Inteligente**;
- `apps/site` criado como site público React/Vite independente do app operacional;
- `apps/admin` recebeu identidade visual MarkMap preservando offline-first, GIS, sync e contratos existentes;
- PWA e Capacitor passam a exibir MarkMap;
- nome visível mobile passa a MarkMap; identificadores nativos existentes permanecem estáveis para preservar continuidade de instalação e dados locais;
- namespaces internos `@geonexo/*` e identificadores históricos de infraestrutura permanecem por compatibilidade até uma migração específica e validada;
- nenhum deploy, release ou publicação em loja foi executado;
- repositório GitHub renomeado para `mmatteuus/MarkMap`.
- PR #3 integrado em `main`.
- branch `feat/markmap-rebrand-site` não contém trabalho exclusivo após o merge e pode ser removida.
- PR #4 integrado em `main`, unificando a direção visual aprovada entre `apps/site` e `apps/admin`; Android/iOS herdam o mesmo frontend via Capacitor.
- revalidação completa do HEAD pós-merge segue pendente; as últimas tentativas de GitHub Actions encerraram antes de iniciar steps.


## Refinamento frontend — 2026-10-05

- auditoria visual classificada como **AUDITAR E MELHORAR**;
- site: botão voltar ao topo deixa de sobrepor o crédito “Desenvolvido por MtsFerreira”, com ajuste responsivo junto ao footer;
- site: persistência/bootstrap do tema protegidos quando `localStorage` estiver indisponível;
- app: dependência visual de Material Symbols removida dos componentes React; menus lateral, mapa, topo, navegação móvel, imports e CRS usam ícones nativos/emoji centralizados em `AppIcon`;
- app: ações primárias e estados de hover/contraste refinados para os tokens MarkMap `#0075D6` / `#00D6DB`;
- app: mapa, projetos, imports, malhas, analytics, settings, sync e PDF receberam ajustes de consistência sem alterar regras de negócio;
- arquitetura offline-first, GIS, sync, IndexedDB/outbox e Capacitor preservados;
- GitHub Actions do HEAD refinado foram reexecutados uma vez, mas os jobs encerraram novamente **antes de qualquer step** (steps vazios), sem evidência de regressão de código. A validação automatizada do HEAD atual segue pendente por runner/infra.


## Console/browser hardening — 2026-10-05

- funcional HEAD da correção: `58cafb64`;
- adicionado `mobile-web-app-capable=yes` mantendo compatibilidade iOS;
- removido `aria-hidden` do link focável da marca no sidebar, eliminando o conflito de foco/a11y reportado pelo Chromium;
- filtros numéricos nullable dos shields do OpenFreeMap agora são protegidos antes do uso em tiles;
- imagens de sprite conhecidamente ausentes (`sports_centre`, `swimming_pool`, `gate`, `office`) recebem fallback transparente via `styleimagemissing`, sem quebrar o mapa;
- o código fonte atual não possui handler `beforeinstallprompt` que chame `preventDefault()`; esse aviso do Chromium não foi tratado adicionando prompt PWA, para preservar a direção de produto de não forçar instalação;
- GitHub Actions foram executadas e reexecutadas uma vez para este HEAD; os jobs continuam encerrando antes de qualquer step (steps vazios), portanto não há evidência de falha de código nem validação verde do HEAD atual.


## Correção de menus — 2026-10-05

- ícones emoji dos menus foram substituídos por SVG inline autocontido em `AppIcon`, eliminando dependência da disponibilidade de fontes/emoji do navegador ou WebView;
- correção cobre sidebar, navegação móvel, header e ferramentas do mapa que já consomem `AppIcon`;
- teste de regressão `apps/admin/src/test/app-icon.test.tsx` garante renderização SVG sem texto/glyph;
- workflows do HEAD atual foram disparados e estavam em fila no momento deste registro.
