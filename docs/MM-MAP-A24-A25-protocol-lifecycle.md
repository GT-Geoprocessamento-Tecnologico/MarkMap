# MarkMap — A24/A25: ciclo de vida dos protocolos MapLibre e rollback de inicialização

**Data:** 2026-10-10  
**Branch-alvo:** `dev/markmap-pwa-v2`  
**HEAD-base confirmado:** `dcc8b93a502eab67c6a2a924224dda15f86bf97d`  
**Estado:** implementação para desenvolvimento offline-first, com testes Node direcionados. Não há aprovação de release nem deploy.

## Objetivo e contexto

Evitar colisões ou perdas de leitores PMTiles e recursos regionais durante troca rápida de mapas, atualizações entre abas, retry e desmontagem/montagem do MapLibre. Corrigir também uma falha parcial de configuração dos controles que deixava uma instância WebGL órfã. As fases A14–A23 mantêm IndexedDB como fonte operacional e fornecem integridade por geração, reconciliação ao foreground, retry visual e diagnósticos. Este incremento reutiliza todas essas partes, sem migrar armazenamento ou alterar backend.

## Auditoria do HEAD antes da edição

- **FUNCIONA:** `CommandCenterPage` registra `pmtiles` e `geonexo-package` via `maplibre-gl.addProtocol`, cada recurso aponta à geração ativa, e desmontagens chamam `map.remove()`.
- **PARCIAL / FALHA DE DESENHO:** `addProtocol`/`removeProtocol` são operações globais por documento. Cada ciclo de mapa os registrava e removia independentemente, criando possibilidade de duplicação ou remoção do handler já em uso por outra montagem.
- **PARCIAL / FALHA DE DESENHO:** o identificador PMTiles usava apenas ID da região; a geração instalada poderia mudar mantendo o mesmo ID e confundindo pedidos de uma visualização antiga com a nova.
- **PARCIAL:** `createMapLibreMap()` instancia `new MLMap` e, se `map.on`, `addControl` ou a configuração síncrona lançar, não removia a instância WebGL criada.
- **FUNCIONA EM CÓDIGO:** A20/A21 retry/fundo neutro, A22/A23 limites/abort/diagnóstico; sem demonstração de colisão num navegador físico.
- **NÃO IMPLEMENTADO:** gerenciamento compartilhado de posse de protocolos e rollback síncrono da configuração parcial.

## Escopo técnico A24

1. `acquireOfflineProtocolLease`: registrar os dois esquemas MapLibre uma vez por documento, com dispatchers compartilhados e leases exclusivos por montagem. Um mapa adquire uma identidade local `mk...` que não se confunde com ID persistido da região.
2. Os loaders PMTiles e assets devem receber a identidade exclusiva de montagem; `adaptOfflineStyle` reescreve URLs de tiles, glyphs e sprites para essa identidade. Os dados não saem do IndexedDB e ficam vinculados à geração explícita escolhida em A19.
3. `release()` é idempotente; liberação de uma visualização remove apenas seu lease. Os esquemas globais são removidos apenas quando não existe nenhum lease ativo. Rollback de registro parcial remove `pmtiles` se falhar o registro de `geonexo-package`.
4. Requests de um lease removido, controlador abortado ou identidade desconhecida falham como `AbortError` e não são encaminhados a outra geração. Após resolver um request, a identidade ainda deve estar ativa; resposta atrasada não pode contaminar o novo mapa.
5. A interface reutiliza o setup, a validação, os estilos e a seleção anteriores. `adaptOfflineStyle(style, manifest)` e `createOfflineProtocol(manifest, file)` mantêm argumentos anteriores válidos por compatibilidade.

## Escopo técnico A25

1. `configureMapWithRollback(map, setup)` encapsula a configuração síncrona do MapLibre; se controles/listeners iniciais lançarem, tenta `map.remove()`, preservando a exceção original se o teardown também falhar.
2. `CommandCenterPage` limpa `mapRef`, controle de localização e lease quando o setup posterior à criação do mapa lança antes de concluir a inicialização.
3. O cleanup mantém seu escopo na instância/generation correspondente; não remove mapa mais novo nem dados persistidos.
4. Manter GeoPDF, rotas, desenhos de campo, outbox, persistência offline, botão retry e fundo simples.

## Fora do escopo

Sem alteração de IndexedDB schema, operações CRUD de pacotes, worker customizado, cache remotos, protocolo de sincronização, Neon/PostGIS, Hono, políticas de quota, GPS, download automático, deploy, CI remoto, merge main, tag/release ou publicação em loja. Não substituir MapLibre/PMTiles nem criar stack paralela.

## Arquivos afetados

- `apps/admin/src/lib/map/offline-protocol-leases.mjs` e `.d.mts` — registry e posse compartilhados.
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — posse do lease e limpeza no erro.
- `packages/maps/src/offline/style.ts` — URLs de recursos por identidade de montagem, com fallback de assinatura antiga.
- `packages/maps/src/offline/protocol.ts` — criação PMTiles por alias, mantendo API de dois argumentos.
- `packages/maps/src/maplibre-setup.mjs` e `.d.mts` — rollback síncrono.
- `packages/maps/src/maplibre.ts` — aplicar rollback à configuração dos controles.
- `scripts/offline-protocol-leases.test.mjs` — testes Node do ciclo de vida.
- `packages/maps/tests/offline/offline-protocol-lifecycle.test.ts` — cobertura Vitest adicional, **não executada** nesta rodada.
- `docs/MM-MAP-A24-A25-protocol-lifecycle.md`, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md`.

## Segurança e critérios de aceite

- Montagens A e B no mesmo origin usam handlers globais registrados uma única vez; seus IDs/URLs de tiles e assets não se cruzam.
- Ao desmontar A, B continua resolvendo seus recursos e nenhum `removeProtocol` global ocorre até a última montagem terminar.
- Qualquer request tardio de A após liberar seu lease resulta em abort, nunca em dados de B; abort normal não gera erro de pacote corrompido na interface.
- Rollback de registro parcial é atômico do ponto de vista do módulo: se segundo esquema falhar, o primeiro é removido, não deixando estado `registered` verdadeiro.
- Falha de configuração de controle/mapa remove a instância criada, preserva o erro original, libera protocolos e permite retry posterior.
- URLs legadas seguem possíveis para consumidores que chamam o estilo/protocolo sem alias explícito; a visualização do `CommandCenterPage` passa a isolar por alias.
- Nenhum `localStorage.clear`, IndexedDB delete de campo, limpeza de outbox ou busca à rede é introduzido.

## QA realmente executada

**Ambiente:** Node v22.16.0, TypeScript `5.8.3`, execução em `/mnt/data/markmap_a24`.

- `node --test scripts/*.test.mjs`: **70/70 PASS**, 0 falhas, 0 skips, 0 cancelamentos. Inclui **10 testes novos A24/A25** e 60 casos anteriores do recorte local A10–A23. Cobertos: registros simultâneos, desmontagem, pedidos atrasados, aliases inválidos, abort, falha ao registrar segundo esquema, re-registro e remoção de mapa parcialmente configurado.
- `node --check` dos dois helpers JS novos: PASS.
- `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022` em `offline-protocol-leases.d.mts` e `maplibre-setup.d.mts`: PASS.
- Revisão estática dos blobs para uso do alias, configuração da sessão e liberação por instância: sem violação encontrada.
- Foi adicionado teste Vitest de estilo com alias e criação do protocolo PMTiles; **ainda não foi executado**.

**NÃO EXECUTADO / não bloqueante ao desenvolvimento:** full lint/typecheck/build monorepo, Vitest com dependências completas, teste MapLibre/PMTiles reais em navegador, duas views simultâneas, Playwright e Android/iOS físico. Não converter isso em evidência de homologação para release.

## Riscos residuais

- Os dispatchers de MapLibre são globais por documento. Se outro subsistema fora desta estratégia registrar o mesmo esquema, pode haver conflito; a auditoria do caminho atual `CommandCenterPage` encontrou a antiga inscrição que foi migrada, mas isso não substitui análise integral futura.
- PMTiles real pode apresentar diferenças de inicialização/cancelamento em Worker; os testes Node usam handlers simulados. Não garantir comportamento em WebGL ou aparelhos físicos.
- Falha assíncrona de carregamento de estilo continua sendo tratada pela A20/A23; `configureMapWithRollback` cobre falhas **síncronas** da criação/configuração dos controles, não eventos assíncronos.
- A assinatura legada de estilo/protocolo continua compatível, mas o uso de alias é necessário para não misturar montagens simultâneas.

## Git, ações proibidas, rollback e relatório final

Reconfirmar HEAD, PRs/issues antes de atualizar `dev/markmap-pwa-v2`. Commit de fast-forward com `[skip ci]`, sem force push nem sobrescrever mudanças de outros agentes. **Não autorizados:** GitHub Actions remoto, merge `main`, deploy Vercel, Neon/migration, secrets, exclusão de dados/branches, release/tag e publicação em loja.

Rollback: reverter somente commit A24/A25, sem migração. Preservar os dados já instalados. Relatório final deve incluir novo SHA, arquivos afetados, validações executadas, pendências e próximo item livre, com Checklist Mestre e Handoff sincronizados no Notion/GitHub.
