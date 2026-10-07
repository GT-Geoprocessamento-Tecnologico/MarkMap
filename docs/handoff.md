# Handoff de continuidade

Atualizado em 2026-10-06.

## Estado atual

- Baseline funcional anterior validado: `cc2331d`.
- HEAD funcional publicado do PWA: `038deb9f` (instalação PWA corrigida e publicada); frontends atuais seguem READY na Vercel.
- Branch remota esperada: somente `main`.
- Arquitetura preservada: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência principal instalável: PWA.
- Capacitor permanece somente como empacotamento opcional.
- Deploy Web/Vercel autorizado e executado em 2026-10-06; nenhum release/tag, migration de production, publicação em loja ou rotação de secrets foi executado.
- Checklist Mestre agora também é versionado em `docs/master-checklist.md`.

## Sincronização de continuidade

Para qualquer mudança relevante de fase, arquitetura, bloqueio, evidência ou próximo passo, atualizar na mesma execução:

1. Checklist Mestre no Notion;
2. `docs/master-checklist.md`;
3. este `docs/handoff.md`.

O Notion é a visão operacional colaborativa; o arquivo no repositório é o espelho auditável/versionado. Em caso de divergência, confirmar primeiro o HEAD real e a evidência mais recente antes de reconciliar os dois.

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
- builds debug Android/iOS;
- site `markmap.mtsferreira.dev` publicado/validado;
- app `appmarkmap.mtsferreira.dev` publicado/configurado e validado por HTTPS.

## Bloqueios externos/release

- política pública de privacidade precisa de identidade/contato/retenção/provedores reais e revisão jurídica;
- API Hono/sync remoto de production ainda precisa ser publicada/configurada; o app continua operacional local-first sem depender disso;
- smoke production exige autorização;
- testes físicos/PWA instalada;
- signing/publicação mobile.

## Próximo item executável

Preparar/publicar o ambiente da API Hono de production e configurar `VITE_API_MODE=live`, `VITE_API_URL` e CORS, sem migration destrutiva. Smoke de sync real continua exigindo autorização explícita.

## Próximo passo de release

Obter os dados/autorizações externos acima e executar o preflight de `docs/release-runbook.md`.

## Rebranding MarkMap — 2026-10-05

- marca pública alterada de GeoNexo para **MarkMap — Planejamento Inteligente**;
- `apps/site` criado como site público React/Vite independente do app operacional;
- `apps/admin` recebeu identidade visual MarkMap preservando offline-first, GIS, sync e contratos existentes;
- PWA e Capacitor passam a exibir MarkMap;
- nome visível mobile passa a MarkMap; identificadores nativos existentes permanecem estáveis para preservar continuidade de instalação e dados locais;
- namespaces internos `@geonexo/*` e identificadores históricos de infraestrutura permanecem por compatibilidade até uma migração específica e validada;
- repositório GitHub renomeado para `mmatteuus/MarkMap`;
- PR #3 e PR #4 integrados em `main`.

## Refinamento frontend — 2026-10-05

- site: overlap footer/crédito MtsFerreira corrigido e tema protegido quando `localStorage` estiver indisponível;
- app: iconografia centralizada em `AppIcon`, consistência visual refinada e arquitetura offline-first/GIS/sync preservada;
- GitHub Actions do HEAD refinado encerraram antes dos steps; a baseline anterior permanece como evidência automatizada.

## Console/browser hardening — 2026-10-05

- `mobile-web-app-capable=yes`;
- conflito `aria-hidden` em elemento focável removido;
- filtros numéricos nullable do OpenFreeMap protegidos;
- fallback de sprites ausentes via `styleimagemissing`;
- nenhum prompt PWA forçado foi introduzido.

## Correção de menus — 2026-10-05

- ícones emoji substituídos por SVG inline autocontido em `AppIcon`;
- cobertura para sidebar, navegação móvel, header e ferramentas do mapa;
- teste de regressão em `apps/admin/src/test/app-icon.test.tsx`.

## Deploy Web/Vercel — 2026-10-06

- Vercel configurada com `markmap-site` (`apps/site`) e `markmap-app` (`apps/admin`);
- site: `markmap.mtsferreira.dev` via CNAME DNS-only para `markmap-site.vercel.app`, HTTPS validado;
- app: erros TypeScript de `storage-management.ts` corrigidos nos commits `4a22770` e `1332350c`;
- app: `appmarkmap.mtsferreira.dev` associado/verificado na Vercel; Cloudflare DNS-only atualizado para o alvo recomendado pela Vercel `b1fa89794ccd409d.vercel-dns-017.com`; HTTPS validado externamente;
- diagnóstico de acesso: `appmarkmap.mtferreira.dev` (sem `s`) não é o domínio configurado e não pertence à zona Cloudflare ativa; o domínio correto é `appmarkmap.mtsferreira.dev`;
- sync remoto de production permanece desativado até publicação/configuração da API Hono;
- nenhuma migration destrutiva, rotação de secret, release/tag ou publicação mobile foi executada.


## Correção de instalação PWA — 2026-10-06

- causa principal identificada: o `beforeinstallprompt` era capturado apenas dentro de Configurações, tarde demais em navegações onde o navegador disparava o evento antes da página montar;
- captura agora acontece globalmente antes do render do app e o mesmo estado é reutilizado pela UI de instalação e pela página de Configurações;
- service worker passa a registrar imediatamente em production, sem aguardar `window.load`;
- manifesto normalizado com `id: "/"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"` e `prefer_related_applications: false`;
- produção validada: `https://appmarkmap.mtsferreira.dev/`, `/manifest.json` e `/sw.js` respondem HTTP 200;
- deploy Vercel do HEAD funcional `038deb9f` está READY;
- confirmação física de instalação em Android/iOS segue pendente.
