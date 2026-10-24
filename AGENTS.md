<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Memoria e rastreabilidade obrigatoria - MarkMap

> Regra do projeto, solicitada pelo responsavel e registrada em **2026-10-24T19:43:34-03:00 (America/Araguaina)** por **ChatGPT (agente documental; OpenAI)**. **Leia [docs/agent-memory-protocol.md](docs/agent-memory-protocol.md) integralmente antes de iniciar qualquer trabalho.**

- **Cerebro oficial (Obsidian externo, nao uma pasta deste Git):** vault `OBSIDIAN_LOCAL_MTS`, pasta exata **`02-PROJECTS/MARKMAP/`**. Comece por `00-INICIO-AQUI.md`, `MARKMAP-FONTE-PRINCIPAL.md`, `01-HANDOFF-VIVO.md`, `02-CHECKLIST-OPERACIONAL.md` e `25-PROTOCOLO-OBRIGATORIO-DE-RASTREABILIDADE.md`.
- **Fontes vivas de conferencia:** [Checklist Mestre Notion](https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204), HEAD/PRs/issues de [`mmatteuus/MarkMap`](https://github.com/mmatteuus/MarkMap). Obsidian e espelhos sao memoria, nao substituem verificacao do estado atual.
- **TODO agente deve registrar cada mudanca relevante** de codigo, docs, QA, CI, configuracao, bug, branch, arquitetura, bloqueio ou decisao no Obsidian; manter Handoff, Checklist e Diario atualizados; sincronizar Notion e issue/PR GitHub quando houver mudanca relevante de estado. **Confirmar a escrita lendo de volta.**
- **Cada registro/atualizacao:** data **e hora ISO 8601 com fuso**, autor real do registro (humano ou agente), origem/URL, data/hora da verificacao, autoria original do fato se comprovada, branch/SHA, arquivos, testes PASS/FAIL/BLOCKED e proximo passo. **Nunca inventar autoria ou horario de fatos legados.** Usar [docs/agent-memory-entry-template.md](docs/agent-memory-entry-template.md).
- Se Obsidian/conector nao estiver acessivel, **nao alegar memoria sincronizada**: registrar pendencia e metadados em PR/issue/Notion acessivel, informar `MEMORIA: PENDENTE` no relatorio e reconciliar posteriormente. Nao alterar dados, custos, protecoes de CI, merge ou producao para contornar falta de memoria.
- **CONSUBOV e outro produto** (`02-PROJECTS/CONSUBOV/`, repo diferente). **Nao consultar/misturar/modificar** dados ou notas do CONSUBOV em tarefas do MarkMap. Preservar identificadores internos historicos do MarkMap por compatibilidade de IndexedDB/storage.

## Versionamento obrigatório para todos os agentes

- Antes de implementar ou publicar, ler [docs/versioning.md](docs/versioning.md) e conferir a versão e o SHA publicados em `https://appmarkmap.mtsferreira.dev/version.json`, além do HEAD, branch e diff locais. Não publicar um checkout antigo que omita o código da versão vigente.
- **Toda atualização publicada exige incremento numérico de `MAJOR.MINOR.PATCH` em `apps/admin/package.json`.** Usar PATCH para correções, MINOR para capacidades novas compatíveis e MAJOR para mudanças incompatíveis. SHA, data, hash de cache e sufixos `-dev`/build não substituem o incremento. Produção usa versão estável.
- O coordenador reserva uma versão por entrega; agentes paralelos não alteram a versão isoladamente. Todos seguem a mesma versão reservada e registram as mudanças e evidências em [CHANGELOG.md](CHANGELOG.md).
- Executar `node scripts/version-release-guard.mjs --base-ref <SHA-base>` antes da entrega e `node scripts/version-release-guard.mjs --dist apps/admin/dist` após o build. O `vite build` aplica o guard; em produção Vercel, compara com o `/version.json` oficial e bloqueia versão reutilizada por outro commit. Guard ausente, inválido ou reprovado impede publicação; não removê-lo nem contorná-lo.
- Mesma versão e mesmo SHA só permitem repetir tecnicamente o mesmo build já publicado. Outra mudança publicada exige outra versão. Promoção de preview para produção também exige a verificação oficial no mesmo candidato.
- Conferir a mesma versão no pacote, rodapé/Configurações, `version.json` gerado e domínio publicado. Registrar versão + commit + validação no resultado final; não concluir apenas porque o deploy ficou READY.
- Preservar os dados, a identidade instalada, protocolos e pisos `minimumCompatibleVersion`. Eles não devem ser incrementados mecanicamente junto com o produto. Quando houver distribuição Android/iOS, alinhar `versionName`/`MARKETING_VERSION` ao pacote e incrementar os contadores nativos conforme o canal, com validação própria.

## MarkMap — contrato protegido para todos os agentes

**Desenvolvido por MtsFerreira.** Ler [docs/site-app-boundaries.md](docs/site-app-boundaries.md) antes de tocar site, PWA, instalação ou créditos.

- `apps/site` e `apps/admin` são produtos separados, em **subdomínios diferentes**, com deploys e origens de armazenamento independentes. O monorepo continua compartilhado.
- A vitrine **não se instala**. Seu botão é um link para a tela `?install=1` do app; só o app apresenta autorização nativa quando disponível e inicia standalone pelo ícone.
- Não criar proxy/rewrites de JS, CSS, imagens, manifest ou shell do app no domínio do site. Preservar redirecionamentos antigos `/app*` para migração.
- Preservar `IndexedDB/outbox`, offline, APIs, Capacitor, frontend e identidade da PWA. Não duplicar implementação.
- **GPS:** guardar somente a preferência do usuário em `permissions:gps` no IndexedDB já existente, nunca forjar autorização do sistema nem armazenar histórico de posições. Ao abrir o mapa, consultar permissão do SO/Capacitor e, se `granted`, obter posição nova do dispositivo; não mostrar prompt sem gesto na PWA. Preservar projetos/GeoPDF selecionados, pan do usuário, limites de mapas offline e testes A67.
- O crédito **Desenvolvido por MtsFerreira · vMAJOR.MINOR.PATCH** deve aparecer no rodapé lateral do app, derivado do pacote sem sufixos. Incrementar a versão canônica conforme a política acima e preservar a assinatura no código; SHA e sufixos não substituem uma nova versão numérica.
- Código curto, tipado e comentado **onde há decisão, risco ou contrato**. Não colocar comentários mecânicos em cada linha; não criar arquivos monolíticos nem reescrever legado funcional apenas por estilo.
- **Contraste obrigatório nos dois temas:** WCAG AA (texto normal >= 4,5:1; grande >= 3:1), inclusive Android, botões em gradiente e mapa de fundo fixamente escuro. Usar cores semânticas de texto (`--color-primary-ink`/`--color-secondary-ink`) sem recolorir o fundo. Executar `node --test scripts/theme-contrast.test.mjs` e QA visual em ambas as aparências.
- **Tema completo:** menu, cabeçalho, formulários, PWA, mapa (controles/fundo), diálogos e prévia 3D devem usar tokens dinâmicos; nenhum painel de UI pode forçar cor escura quando o tema é claro. Preservar imagens, tiles cartográficos e cores da marca. Validar `node --test scripts/theme-surfaces.test.mjs` e Playwright nos dois temas, desktop/Android.
- **Atalhos do mapa:** Altitude, Busca, Lugares/Transporte e Navegação GPS offline devem aparecer na barra de atalhos comum, nunca em cards flutuantes fixos. Manter as funções montadas ao fechar os painéis, chaves React distintas e barra acessível no celular com painel aberto. Cobertura em `apps/admin/e2e/map-offline-shortcuts.spec.ts`.
- **Catálogo de mapas offline:** opção **Baixar mapas** no próprio mapa e catálogo em Configurações, com a mesma implementação `RegionDownloadCatalog`. Formulários `manifest.json`/PMTiles/URL só em opções avançadas. Publicar apenas regiões reais, licenciadas, com manifest HTTPS/CORS, tamanhos/bounds compatíveis e verificação SHA-256. O catálogo vazio nunca deve fingir disponibilidade. Não substituir `ResumableInstaller` nem apagar mapas/outbox.
- Conferir HEAD e Checklist Mestre, revisar diff e executar testes de fronteira antes de commits. Não declarar QA físico sem executar.


- **A71 — mapas, PDF e busca:** a sugestão de região usa somente GPS com autorização real e seleção local; não baixa dados por padrão; download automático só quando o usuário ativa consentimento persistido localmente, houver GPS permitido, conexão e região publicada. Nunca inventar pacotes no catálogo vazio. Preview GeoPDF mantém raster/original e coordenadas sem reprojetar ou comprimir. Pesquisa de endereços opera offline e online só via provedor próprio autorizado; não acoplar Nominatim público diretamente. Os domínios site/app permanecem separados.
