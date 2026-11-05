# MarkMap A248 - Integracao local de PRs #104-#109: QA final

Data: 2026-11-05 (America/Araguaina). Executor: ChatGPT via VPS_MTS no container privado markmap-vscode.

## Base e escopo
- Branch: qa/pr104-109-e2e-a248-20261105.
- Base: 3128e86f9b59e09a34b0a34dba10020acfc373f9 (integracao A247).
- Os seis HEADs remotos #104-#109 foram confirmados como ancestrais da base.
- Somente cinco suites E2E antigas foram alinhadas com a interface IndexedDB/local-first atual, a partir dos testes comprovados na A246. Configuracoes Playwright a248 sao apenas locais/untracked.
- Sem alteracao em codigo produtivo, APIs, SW, armazenamento, bancos ou outros projetos.

## Evidencia A248 na VPS
- pnpm install --offline --frozen-lockfile: PASS exit 0.
- Admin typecheck e ESLint dirigido: PASS exit 0.
- Vite build de admin 0.5.22 com mock/disabled: PASS exit 0, 45 assets no manifesto.
- pnpm ci:local --strict-version: PASS exit 0 (typecheck, lint, unitarios, release guard, PWA/SW).
- Playwright Chromium: 47/47 PASS, 0 FAIL, exit 0.
- Firefox com Xvfb/Mesa por software: 15 PASS/4 SKIP; 9 PASS/5 SKIP; 12 PASS/2 SKIP. Total 36 PASS, 11 SKIP Chromium-only, 0 FAIL, tres lotes exit 0. O primeiro lancamento falhou antes dos testes por import incorreto da config local a247; corrigido o runner local e reexecutado inteiramente com exit 0.
- WebKit/Pixel7/iPhone13 emulados (runner isolado): 12/12 PASS, exit 0.
- git diff --check: PASS exit 0.
- Logs e markers: ~/.cache/a248-qa/{install,typecheck,eslint,build,chromium,ci-strict,crossbrowser,audit,diff}.log e .exit; firefox-full-batch{1,2,3}.log/.exit; firefox-controller-retry.exit.
- Build monorepo 8/8 aprovado anteriormente na integracao A247, antes dos ajustes exclusivos de testes E2E. Nao foi reexecutado integralmente em A248.

## Bloqueio de seguranca - nao homologar release
- pnpm audit --prod: FAIL exit 1, quatro vulnerabilidades (1 HIGH Zod 3.25.76 GHSA-mrhx-c7xc-m3w5; 3 MODERATE: Seroval 1.6.8 com duas advisories GHSA-f86p-h4j2-7qgj e GHSA-9wx9-5pv9-3349, e @hono/node-server 1.19.17 GHSA-rmxm-3fg6-px4f).
- A PR #109 isolada nao elimina esse conjunto. As correcões Zod4.6.6, Seroval1.6.11 e @hono/node-server2.1.3 passaram anteriormente no worktree A246 mas nao fazem parte da soma exata #104-#109. Exigem integracao pontual e repeticao dos testes antes de release.
- QA fisico Android/iOS, sincronizacao Neon HTTP e CI remota no SHA integrado nao executados. Google login e sync remoto permanecem desativados.

## Regras e proximo passo
- Nenhum commit na main, merge remoto, push, deploy, release, migracao, modificacao de segredos, permissao ou dados de usuario.
- Proximo: escopo isolado de remediacao das quatro vulnerabilidades usando patches A228/A229/A246 validados, preservar o teste backup da PR #106, executar audit/CI/build/E2E novamente. Depois coordenar PR Draft para revisao e possivel publicacao mediante autorizacao.
