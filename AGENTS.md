<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## MarkMap — contrato protegido para todos os agentes

**Desenvolvido por MtsFerreira.** Ler [docs/site-app-boundaries.md](docs/site-app-boundaries.md) antes de tocar site, PWA, instalação ou créditos.

- `apps/site` e `apps/admin` são produtos separados, em **subdomínios diferentes**, com deploys e origens de armazenamento independentes. O monorepo continua compartilhado.
- A vitrine **não se instala**. Seu botão é um link para a tela `?install=1` do app; só o app apresenta autorização nativa quando disponível e inicia standalone pelo ícone.
- Não criar proxy/rewrites de JS, CSS, imagens, manifest ou shell do app no domínio do site. Preservar redirecionamentos antigos `/app*` para migração.
- Preservar `IndexedDB/outbox`, offline, APIs, Capacitor, frontend e identidade da PWA. Não duplicar implementação.
- O crédito **Desenvolvido por MtsFerreira · vMAJOR.MINOR.PATCH** deve aparecer no rodapé lateral do app, derivado do pacote sem sufixos (ex.: `v0.2.0`). Preservar a versão interna e a assinatura no código.
- Código curto, tipado e comentado **onde há decisão, risco ou contrato**. Não colocar comentários mecânicos em cada linha; não criar arquivos monolíticos nem reescrever legado funcional apenas por estilo.
- Conferir HEAD e Checklist Mestre, revisar diff e executar testes de fronteira antes de commits. Não declarar QA físico sem executar.
