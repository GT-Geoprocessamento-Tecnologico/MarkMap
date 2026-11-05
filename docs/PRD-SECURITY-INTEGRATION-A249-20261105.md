# A249 - Security remediation integrated PR #104-#109

Objective: remove four audited production dependency advisories in isolated worktree based on A248, preserving all six PRs and offline-first behavior.
Context: A248 HEAD b578bed0, Chromium 47/47, Firefox 36 pass/11 skipped, WebKit/mobile emulation 12/12; pnpm audit --prod exit 1 on Zod 3.25.76, Seroval 1.6.8 and @hono/node-server 1.19.17.
Scope: pin Zod 4.6.6 on four direct dependencies, Seroval 1.6.11 override, @hono/node-server 2.1.3 and lockfile. Apply existing validated Zod4 compatibility patches for contracts/API/admin client. Keep PR #106 backup test in admin package script.
Out of scope: production deploy, main merge, remote push, auth/sync activation, databases, secrets, permission changes, user data or other project containers.
Affected files: package.json, pnpm-lock.yaml, packages/contracts source/tests/dependency, packages/db dependency, apps/admin dependency/client, services/api dependency/routes; no GIS product redesign.
Security: do not copy private environment variables, remove authentication or weaken tests. Keep offline IndexedDB/outbox and existing explicit disabled Google/Neon flows.
Acceptance criteria: pnpm install frozen, pnpm audit --prod exit 0 without exceptions, pnpm ci:local --strict-version exit 0, pnpm turbo run build --force exit 0, Chromium 47 pass, Firefox 36 pass/11 preexisting skip, crossbrowser 12 pass. Preserve PR106 device-preflight node test. Git diff --check and verify all 6 PR head commits are ancestors.
Tests/QA: use dedicated ~/.cache/a249-qa logs with exit markers, Playwright local preview port 5195, isolated Xvfb/Mesa. No claims about physical devices, CI remote or Neon.
Documentation: update Obsidian Handoff/Checklist/Diary and Notion after evidence; record blockers and exact SHA.
Git: new branch qa/pr104-109-security-a249-20261105 from b578bed0, do not touch A248/A247/main. No force push or deployment.
Prohibited actions: deletes/truncates production, migrations, release, tags, cache/outbox reset, secret rotation, inter-project changes.
Risks: breaking API contract during Zod3 to Zod4, Hono2 minor-to-major interface, generated artifacts; exercise entire CI and E2E before accepting.
Final report: exact versions, file delta, audit results, CI/build/E2E results, SHA, remaining gates and rollback via isolated branch.
