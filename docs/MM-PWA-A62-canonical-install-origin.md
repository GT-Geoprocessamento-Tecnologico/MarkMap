# MM-PWA-A62 — instalação e lançamento pela origem do aplicativo

**Data:** 2026-10-13. **HEAD auditado:** `main@ddc39ecf1b3cd7fcfc07089f9fd1838699feae93`. Checklist Mestre Notion e `GEONEXO_FONTE_CHATGPT.md` consultados; nenhum PR/issue aberto.

## Sintoma e evidência

Usuário instala pela vitrine mas, ao abrir o ícone, não chega à aplicação. Vitrine `https://markmap.mtsferreira.dev` publicava manifest instalável (`start_url=/app/`, ID `/app/`) e registrava Service Worker de proxy. `https://markmap.mtsferreira.dev/app/` foi verificado por TinyFish retornando **404** em 2026-10-13. Já `https://appmarkmap.mtsferreira.dev/` retorna a interface operacional de projetos. São dois projetos Vercel no mesmo monorepo: `apps/site` e `apps/admin`, cada qual com domínio customizado já existente.

## Classificação antes das alterações

- **FUNCIONA:** app na origem dedicada: manifest `id=/`, `start_url=/`, `scope=/`, `display=standalone`; Service Worker offline, pré-cache shell, React/Vite, Capacitor.
- **QUEBRADO:** manifesto e botão da vitrine instalam `/app/` do domínio marketing, que retorna 404 em produção. Proxy trans-origem e SW da vitrine criam identidade PWA diferente do app de verdade.
- **PARCIAL:** instalação anterior na origem de marketing pode continuar com ícone antigo. Navegadores não garantem migração automática entre origens.
- **NÃO IMPLEMENTADO:** gate automatizado que exige origem canônica e impede regressão da vitrine a ser app instalável.

## Decisão e escopo

Preservar **dois domínios e dois projetos Vercel**, sem novo domínio, sem troca do frontend. Marketing é apenas vitrine, sem manifest/registro de SW instalável; CTAs tornam-se links sem JS para `https://appmarkmap.mtsferreira.dev/?install=1`. Origem do app continua `https://appmarkmap.mtsferreira.dev/`; ali permanece a instalação nativa (standalone, manifest, SW e IndexedDB). Rotas legadas `/app`, `/app/`, `/app/:path*` no domínio da vitrine respondem com redirect temporário ao domínio do app. Worker legado, se atualizado, deve encaminhar navegação `/app*` à origem canônica sem armazenar documentos; página de marketing pode limpar **apenas** worker/caches pertencentes à antiga vitrine, nunca IndexedDB de mapas/dados do app.

## Fora do escopo e proibições

Não mover `apps/admin` para `apps/site`, não unificar origens de armazenamento, não tocar em IndexedDB, dados locais, API Hono, Neon/PostGIS, secrets, migrações, mapas, scripts de loja ou assets visuais. Não publicar manualmente em domínio público, gerar release/tag nem alterar Vercel project settings sem autorização. Commits na main podem acionar integração automática Vercel existente.

## Arquivos previstos

`apps/site/src/site-config.ts`, `apps/site/src/components/InstallAppButton.tsx`, `apps/site/index.html`, `apps/site/src/main.tsx`, `apps/site/src/App.tsx`, `apps/site/vercel.json`, `apps/site/public/sw.js`; teste atualizado `apps/site/src/site-config.test.ts`, `apps/site/src/app-install-manifest.test.ts`; experiência de instalação `apps/admin/src/components/pwa/PwaInstallPrompt.tsx` sem alterar tela principal.

## Segurança, rollback e QA

- Nunca instalar o site marketing, nem cachear navegações privadas. Preservar origem real do app, mesma ID PWA `/`, mesmo IndexedDB e experiência offline.
- Manter redirect antigo como migration de URL; app já instalado no domínio correto não deve precisar reinstalar.
- Usuários que instalaram a **vitrine** devem remover ícone antigo e instalar a aplicação canônica uma vez; não há migração de armazenamento entre origens por segurança.
- Gates: testes de manifest/redirect/CTA, typecheck, lint, build site+app e smoke de URLs com redirecionamentos; regressão offline/Service Worker e E2E simulados conforme ambiente. Não inventar testes físicos.
- Rollback via `git revert` normal do(s) commit(s) de A62 se observadas falhas; nunca force push.
- Relatório final: arquivos alterados, SHA HEAD, evidências efetivamente executadas, estado do domínio e instrução curta ao usuário que instalou a versão antiga.
