# MM-MAP-A70 — escolher e baixar mapas dentro do MarkMap

Data: 2026-10-13. Base auditada: `main@7818c8ec608bf82003d9d5607c6d006e029b8028`, sem PRs abertos.

## Objetivo

O usuário comum deve escolher regiões por nome diretamente no mapa ou em Configurações e baixar um pacote disponível com um clique, ver progresso, retomar/cancelar, e utilizá-lo offline. Nenhum conhecimento de `manifest.json`, PMTiles, SHA-256 ou URL deve ser exigido na experiência principal.

## Auditoria (antes da mudança)

- **FUNCIONA**: `ResumableInstaller` com Range/checkpoints, orçamento local de 250 MiB, validações SHA-256, instalação atômica, atualização e escolha de pacotes instalados; botão próprio de mapas e menu existente.
- **PARCIAL**: Configurações permite importar pasta ou inserir URL HTTPS de `manifest.json`; esses campos técnicos aparecem como fluxo principal e não há acesso direto pelo mapa.
- **NÃO IMPLEMENTADO**: catálogo de regiões publicadas com metadados, seleção por nome e CTA de download na interface. A árvore do repositório não contém pacotes PMTiles publicados nem manifesto de catálogo. **Não inventar opções disponíveis.**
- **SEM EVIDÊNCIA**: infraestrutura de distribuição/CORS e licenciamento para novos mapas. A publicação de pacotes reais é uma entrega separada; não simular downloads.

## Escopo

1. Catálogo estático e versionado sob a origem do app, com registro seguro e simples de regiões (id, título, limites WGS84, tamanho, fonte pública HTTPS do manifest). Inicialmente vazio até serem publicados mapas reais/creditados.
2. Componente compartilhado de catálogo em Configurações e no **menu de atalhos do mapa**, com busca textual, informações de tamanho, status instalado, ordenação de regiões próximas ao centro atual e mensagens honestas se vazio/sem rede.
3. Reusar integralmente `fetchRemoteRegionManifest`, `offlineMapPackageManifestSchema`, `ResumableInstaller`, `offlineMapStore` e `setSelectedOfflineMapId`; após sucesso, selecionar o mapa instalado e comunicar mudança no app.
4. Progresso %, pausa/cancelamento seguro, retomada e aviso explícito quando necessário substituir checkpoints de versão; atualização/remoção existentes preservadas.
5. Em Configurações, mover pasta e URL para **Opções avançadas**, preservando acessibilidade e o comportamento anterior.

## Fora do escopo

Gerar novos PMTiles de fontes OSM, fingir disponibilidade, fazer bulk download de tiles OSM, usar serviços ou licenças sem acordo, aumentar orçamento de armazenamento, alterar Neon/Hono/Capacitor, migrar IndexedDB, trocar stack, mapa padrão, PWA ou UI geral.

## Arquivos previstos

`apps/admin/public/maps/catalog.json`, `apps/admin/src/lib/storage/public-region-catalog.ts`, seus testes; `apps/admin/src/components/map/RegionDownloadCatalog.tsx` e testes; `apps/admin/src/pages/settings/SettingsPage.tsx`; `apps/admin/src/pages/workspace/CommandCenterPage.tsx`; `apps/admin/e2e/map-region-download.spec.ts` e docs de operação.

## Segurança e dados

Catálogo exclusivamente da própria origem do aplicativo, schema estrito, limites de tamanho/número de itens e URLs públicas HTTPS sem credenciais, redirects/query ou hash. Referências de região e custos declarados no catálogo precisam bater com manifest validado. Integridade dos bytes é validada **pelo instalador existente**. Não apagar mapas, projetos, outbox nem checkpoints sem gesto específico; não armazenar segredos nem posição do usuário. Ao mudar de tela/cancelar, abortar download e preservar blocos válidos.

## Critérios de aceite

- "Baixar mapas" existe no menu do mapa, clicável Windows/Android; catálogo mostra regiões publicadas ou vazio honesto sem formulário técnico.
- Configurações mostra catálogo e a importação manual somente quando o usuário expande "Opções avançadas".
- Busca seleciona região quando há itens; botão usa URL do próprio catálogo sem o usuário digitá-la.
- Preview confere manifest/id/bounds/tamanho. Sucesso seleciona mapa e mantém operável offline. Falha não altera mapa ativo.
- Progresso e retomada/cancelamento; diálogo/aviso para pacote de versão alterada.
- Catálogo indisponível sem internet não impede acessar mapas instalados nem operação normal.
- Fundo/base MapLibre, GPS, GeoPDF e trabalho dos outros agentes intocados.

## Testes e QA

Typecheck, lint dos arquivos afetados, Vitest de validação de catálogo e fluxo UI, build da Vercel, Playwright Windows/Android e, se possível, verificação offline. **Não declarar download real concluído sem um pacote distribuído válido.** Documentar CI bloqueado, QA físico pendente e indisponibilidade real de catálogo até publicação.

## Git, decisões proibidas e rollback

Conferir HEAD antes de integrar; mudanças pequenas apenas na `main` mediante autorização prévia deste fluxo. Sem force push/release, migração destrutiva, deploy manual, proxy entre site e app, publicação de mapas sem licença. Revert normal da mudança de interface sem apagar pacotes instalados. Atualizar Handoff, Checklist Mestre GitHub e Notion ao finalizar.

## Riscos e entrega esperada

Catálogo inicialmente vazio não libera download por si só: é obrigatória publicação de pacotes regionais válidos com CORS/Range, checksum e direitos de distribuição. Limite de 250 MiB mantido. Relatório com SHA, testes executados, limitações e próximos passos verificáveis.
