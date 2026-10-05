# Handoff de continuidade

Atualizado em 2026-10-05.

## Estado atual

- Baseline funcional anterior validado: `cc2331d`.
- HEAD atual da `main`: `0cbb58e` (merge do rebranding/site MarkMap).
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
- revalidação completa do HEAD pós-merge segue pendente; as últimas tentativas de GitHub Actions encerraram antes de iniciar steps.
