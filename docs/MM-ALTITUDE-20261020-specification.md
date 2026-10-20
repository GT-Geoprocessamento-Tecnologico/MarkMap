# MM-ALTITUDE-20261020 — altitude de terreno online e offline

Status: SPECIFICATION GATE — DONE. Implementação autorizada; static/service review passed. Final release gate remains pending real browser AWS online/offline QA.

## Objetivo e escopo

O painel de Altitude deve consultar a altura real do terreno no ponto escolhido/centro do mapa e exibir perfil de uma linha de medição ou rota, funcionando com rede e depois sem rede. A experiência deve continuar válida quando o pacote regional não tiver DEM: o usuário poderá baixar uma grade de terreno limitada para a região/viewport e reutilizá-la offline.

Preservar a arquitetura, os dados locais e as mudanças sujas existentes no worktree `C:\Users\MATEUS\AppData\Local\Temp\markmap-production-release-20261019`, branch `work/prod-araguaina-20261019`, HEAD `63eb7459`. O escopo de implementação do UI Builder é `OfflineElevation.tsx`, seu teste e um helper/componente novo sob `apps/admin/src/components/map/` quando necessário. O Root integra o `CommandCenterPage`; o data-source/service builder fornece a API de terreno. Não alterar mapas, busca, catálogo, backend, dependências, Service Worker, IndexedDB ou código nativo nesta tarefa.

## Evidência e decisões obrigatórias

- `OfflineElevation.tsx` já lê `manifest.demGrid` com `getActiveRevision()` e `assetAtRevision()`, valida tamanho/SHA-256/`validateRegionalDem()` e calcula o perfil regional sem rede. Essa funcionalidade é a prioridade máxima e deve permanecer intacta.
- `packages/maps/src/elevation/regional-dem.mjs` já fornece amostragem bilinear e perfil com `null` para no-data; nunca converter ausência em `0`.
- Os manifestos regionais atuais auditados declaram `elevation: false`; isso explica por que o painel não pode depender somente do DEM do pacote.
- AWS Terrain Tiles, sua documentação/CORS e uma amostra real de Araguaína de aproximadamente 254 m foram confirmados pelo data-source. O serviço deve expor metadados honestos de origem, licença, datum e resolução efetiva; o UI não pode inferir SRTM, EGM96 ou precisão de 30 m.

## Contrato do service builder

O UI Builder consome uma API injetável/importável, sem inventar URL ou provider:

```ts
type TerrainBounds = [number, number, number, number];
type TerrainGrid = {
  values: number[];
  metadata: {
    width: number; height: number;
    bounds: TerrainBounds;
    resolutionMeters: number;
    attribution: string; license: string;
    sourceUrl: string; verticalDatum: string;
    noDataValue?: number;
  };
};
type TerrainPoint = {
  elevationMeters: number | null;
  resolutionMeters: number;
};
type DownloadParams = {
  regionId: string;
  bounds: TerrainBounds;
  signal?: AbortSignal;
  onProgress?: (progress: { loaded: number; total?: number }) => void;
};

getTerrainPoint(
  lon: number, lat: number, signal?: AbortSignal,
): Promise<TerrainPoint>;
getCachedTerrainGrid(
  regionId: string, bounds: TerrainBounds,
): Promise<TerrainGrid | null>;
downloadTerrainGrid(params: DownloadParams): Promise<TerrainGrid>;
removeCachedTerrainGrid(
  regionId: string, bounds: TerrainBounds,
): Promise<void>;
```

A grade deve ter no máximo 64 tiles, dimensão final máxima 256×256 e 2 MiB. O service deve aplicar timeout, limite de bytes em streaming e cancelamento; para PNG, validar decode, `256×256`, `createImageBitmap(..., { colorSpaceConversion: 'none' })` e a codificação oficial documentada. Deve validar os dados reconstruídos e SHA-256 localmente; header/cache metadata isolado não é prova de integridade. A persistência é Cache API em namespace dedicado/versionado, independente de manifest/PMTiles, com escrita atômica e reabertura offline. Não redownloadear mapas já instalados.

## Contrato do UI Builder

Manter as props existentes e acrescentar as seguintes:

```ts
type OfflineElevationProps = {
  packageId: string | null;
  route: Route | null;
  open: boolean;
  onClose: () => void;
  center?: [number, number];
  viewportBounds?: TerrainBounds;
  profileGeometry?: Array<[number, number]>;
};
```

`profileGeometry` representa a linha de medição e tem prioridade; se ausente, usar `route.geometry`. O painel não pode exigir `routingGraph` ou rota para tornar o ponto/centro disponível. O Root fornece `center`, `viewportBounds` e a linha de medição.

A fonte é selecionada nesta ordem: (1) DEM válido do manifest ativo quando o ponto/linha estiver dentro dos bounds; (2) grade Cache API compatível para a região/bounds; (3) consulta online de ponto via `getTerrainPoint`; (4) estado explícito sem dado. Para perfil, a grade do manifest/cache é necessária: o botão de download carrega a área online e torna o perfil disponível. Nunca mostrar número falso, interpolação fora de bounds ou `0` para no-data.

Ao abrir o painel, consultar automaticamente apenas o ponto central/selecionado, com debounce de 300 ms e `AbortController`. Cancelar efeitos e descartar respostas antigas para que uma resposta tardia não atualize a região/ponto atual. O resultado primário deve mostrar altura real, resolução aproximada, fonte/atribuição, datum composto documentado e indicação `online` ou `local`.

Exibir o botão “Baixar altitude deste mapa”. Com `packageId` e manifest ativo, usar os bounds do manifest; sem região, permitir somente `viewportBounds` explícito. Exibir progresso, cancelar, retry e erro de quota de forma honesta. Após concluir, ler a grade cacheada e permitir ponto/perfil sem rede ao reabrir. Remoção da própria grade pode ser oferecida, mas não é requisito do UI Builder.

Preservar `MapOfflinePanel`, a montagem enquanto fechado e o atalho existente; somente o texto visível do atalho pode mudar de “Altitude offline” para “Altitude”.

Para reutilizar a matemática existente, adaptar `TerrainGrid` a uma forma estrutural `DemSampleGrid` (`values` + `metadata.width/height/bounds/noDataValue`) e manter `sampleRegionalDem`/`computeRegionalElevationProfile` semanticamente iguais. A validação estrita de `manifest.demGrid` não deve ser relaxada.

## Grafo de tarefas e dependências

| ID | Responsável | Entrega | Dependência |
|---|---|---|---|
| ALT-01 | data-source/service | API `TerrainBounds`, `TerrainGrid`, ponto, cache, download cancelável e remoção; AWS Terrain Tiles com metadados/licença/datum/resolução honestos. | documentação/CORS e fixture Araguaína confirmados |
| ALT-02 | maps/core | Adaptador estrutural `DemSampleGrid` e reutilização da amostragem/perfil, preservando DEM publicado e no-data. | ALT-01 para tipos do grid |
| ALT-03 | UI Builder | Atualizar `OfflineElevation.tsx`/testes: ponto/centro, linha de medição/perfil, seleção de fonte, download/cache, estados e cancelamento. | ALT-01/ALT-02 |
| ALT-04 | Root | Passar centro, viewport bounds e measurement line do CommandCenter; atualizar label sem desmontar o atalho. | ALT-03 |
| ALT-05 | QA independente | Browser com ponto online real, última resposta vence, DEM antigo/generation guard, leitura offline após reload, download/cancelamento/retry, no-data, bounds e quota. | ALT-01–04 |

## Critérios de aceitação

1. O painel preserva o fluxo antigo: DEM de manifest ativo é validado por tamanho, SHA-256, geração e `validateRegionalDem` antes de uso.
2. Com rede, o ponto/centro consulta altura real; debounce, abort e latest-request-wins impedem estado obsoleto.
3. Sem rede, ponto e perfil usam DEM do manifest ou grade cacheada compatível; reabrir o painel não perde a grade persistida.
4. “Baixar altitude deste mapa” escolhe bounds do manifest ou viewport explícito, mostra progresso/cancelamento/retry e respeita 64 tiles, 256×256 e 2 MiB.
5. O perfil usa `profileGeometry` antes de `route.geometry`; linha de medição funciona sem `plannedRoute`/`routingGraph`.
6. No-data, ponto fora da cobertura, erro online, cache corrompido, quota e cancelamento geram estados explícitos; nenhum deles exibe zero ou valor inventado.
7. A UI mostra altura, resolução, fonte/atribuição, datum documentado e origem online/local. Não afirmar precisão ou datum não fornecido pela fonte.
8. Testes focados cobrem bounds, ponto online, resposta antiga, leitura offline, download cancelado, no-data e guarda do DEM antigo. QA independente deve executar browser online e offline real, além de typecheck/lint/build/testes aplicáveis.

## QA gate and risks

A revisão técnica foi registrada nos artefatos externos de QA desta tarefa. Runtime validation against AWS Terrain Tiles and a real browser offline reload is still required before release acceptance; fixtures, mocks, build output, and a local API call do not satisfy that gate.

## Riscos e stop conditions

Parar se a API do service não fornecer metadados/licença/datum/resolução, se AWS/CORS estiver indisponível, se a grade exceder limites, se a resposta não puder ser validada, se a integração exigir novo backend/chave/schema/IDB/SW, ou se a implementação misturar gerações do manifest. Fixtures não contam como dado de produção. Código compilado ou chamada local isolada não prova o fluxo online/offline.

Cada worker deve entregar arquivos alterados, SHA/dirty state, comandos, testes, evidência e riscos. A revisão independente deve confirmar que somente `OfflineElevation.tsx`, teste/helper, documento e a integração explicitamente atribuída ao Root foram tocados, preservando busca, catálogo, mapas, storage existente e dados do usuário.
