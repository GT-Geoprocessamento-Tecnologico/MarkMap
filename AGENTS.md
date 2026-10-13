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
- **GPS:** guardar somente a preferência do usuário em `permissions:gps` no IndexedDB já existente, nunca forjar autorização do sistema nem armazenar histórico de posições. Ao abrir o mapa, consultar permissão do SO/Capacitor e, se `granted`, obter posição nova do dispositivo; não mostrar prompt sem gesto na PWA. Preservar projetos/GeoPDF selecionados, pan do usuário, limites de mapas offline e testes A67.
- O crédito **Desenvolvido por MtsFerreira · vMAJOR.MINOR.PATCH** deve aparecer no rodapé lateral do app, derivado do pacote sem sufixos (ex.: `v0.2.0`). Preservar a versão interna e a assinatura no código.
- Código curto, tipado e comentado **onde há decisão, risco ou contrato**. Não colocar comentários mecânicos em cada linha; não criar arquivos monolíticos nem reescrever legado funcional apenas por estilo.
- **Contraste obrigatório nos dois temas:** WCAG AA (texto normal >= 4,5:1; grande >= 3:1), inclusive Android, botões em gradiente e mapa de fundo fixamente escuro. Usar cores semânticas de texto (`--color-primary-ink`/`--color-secondary-ink`) sem recolorir o fundo. Executar `node --test scripts/theme-contrast.test.mjs` e QA visual em ambas as aparências.
- **Tema completo:** menu, cabeçalho, formulários, PWA, mapa (controles/fundo), diálogos e prévia 3D devem usar tokens dinâmicos; nenhum painel de UI pode forçar cor escura quando o tema é claro. Preservar imagens, tiles cartográficos e cores da marca. Validar `node --test scripts/theme-surfaces.test.mjs` e Playwright nos dois temas, desktop/Android.
- **Atalhos do mapa:** Altitude, Busca, Lugares/Transporte e Navegação GPS offline devem aparecer na barra de atalhos comum, nunca em cards flutuantes fixos. Manter as funções montadas ao fechar os painéis, chaves React distintas e barra acessível no celular com painel aberto. Cobertura em `apps/admin/e2e/map-offline-shortcuts.spec.ts`.
- **Catálogo de mapas offline:** opção **Baixar mapas** no próprio mapa e catálogo em Configurações, com a mesma implementação `RegionDownloadCatalog`. Formulários `manifest.json`/PMTiles/URL só em opções avançadas. Publicar apenas regiões reais, licenciadas, com manifest HTTPS/CORS, tamanhos/bounds compatíveis e verificação SHA-256. O catálogo vazio nunca deve fingir disponibilidade. Não substituir `ResumableInstaller` nem apagar mapas/outbox.
- Conferir HEAD e Checklist Mestre, revisar diff e executar testes de fronteira antes de commits. Não declarar QA físico sem executar.


- **A71 — mapas, PDF e busca:** a sugestão de região usa somente GPS com autorização real e seleção local; nunca baixa dados antes do clique consciente nem inventa pacotes no catálogo vazio. Preview GeoPDF mantém raster/original e coordenadas sem reprojetar ou comprimir. Pesquisa de endereços opera offline e online só via provedor próprio autorizado; não acoplar Nominatim público diretamente. Os domínios site/app permanecem separados.
