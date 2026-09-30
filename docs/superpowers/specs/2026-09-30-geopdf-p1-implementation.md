# GeoNexo GeoPDF P1 — especificação de implementação local-first

**Data:** 2026-09-30  
**Gate:** `P1-SPEC-REVIEW` PASS em 2026-09-30; implementação local P1 autorizada dentro deste escopo.  
**Escopo:** parser, transformações, worker e renderização local de GeoPDF/PDF. Persistência, sincronização Neon e calibração manual são dependências separadas.

## 1. Decisão e subset suportado

G0.2, G0.3 e G0.5 são pré-requisitos. G0.3 é PASS para viabilidade delimitada, não para suporte geral. G0.4 remoto/Neon permanece bloqueado e não é dependência local.

| Perfil | Entrada e eixos | Transformação | Regra |
|---|---|---|---|
| ISO VP/Measure GEO geográfico WGS84 | GPTS em [latitude, longitude]; saída GeoNexo [longitude, latitude] | LPTS unitários → BBox do viewport | Uma viewport explícita; múltiplas sem seleção falham |
| ISO VP/Measure GEO projetado aprovado | GPTS em [easting, northing] no CRS declarado | LPTS → BBox; converter pelo registry local | Manter somente CRS já provados; novo CRS exige fonte, fixture e revisão |
| OGC LGIDict básico | Somente `/CTM [a,b,c,d,e,f]` + `/Neatline`; `/Projection /GEOGRAPHIC /WGE` | x'=a*x+c*y+e; y'=b*x+d*y+f | Uma moldura; `/Registration`, projeção desconhecida e variantes Display/LGIT:Info falham até prova própria |
| PDF sem georreferência | Sem CRS implícito | Nenhum posicionamento automático | needs-calibration; manual fica em P3 |
| Araguaína do projeto | Declaração projetada incompatível com GPTS observado | Nenhum | Falhar fechado, nunca inferir pelo nome |

Não inferir CRS por nome, texto, magnitude ou bounds externos. Dateline, polos, não afim, datum não registrado, rotação não provada e insets ambíguos permanecem fora do subset.

### Registry de CRS P1

O registry é um allowlist TypeScript local em `packages/geo/src/pdf/crs-registry.ts`, sem lookup remoto. Cada entrada contém `id`, perfis permitidos, correspondência exata do metadado PDF, ordem recebida, ordem cartesiana interna `[x,y]`, unidade, definição PROJ fixada, faixa válida e fixtures independentes. Não aceitar códigos EPSG arbitrários nem WKT semanticamente parecido.

| ID | Perfil/metadado aceito | Entrada no PDF | Interno e unidade |
|---|---|---|---|
| `EPSG:4326` | ISO `/GCS /GEOGCS /EPSG 4326`; OGC `/ProjectionType /GEOGRAPHIC /Datum /WGE` | ISO GPTS `[latitude,longitude]`; LGIDict usa `x=longitude,y=latitude` após CTM | `[longitude,latitude]`, graus; longitude `(-180,180)`, latitude `(-90,90)`, sem atravessar antimeridiano |
| `EPSG:32620` | ISO WKT UTM 20N exatamente igual ao WKT validado na fixture P0, removendo somente whitespace | GPTS `[easting,northing]` | `[easting,northing]`, metros; area of use `66°W–60°W`, `0°–84°N` |

`EPSG:3857`, `EPSG:4674`, variantes de datum, outras zonas UTM e outras grafias WKT ficam UNSUPPORTED neste gate. Em particular, o PDF de Araguaína não entra no registry: a combinação declarada de EPSG:3857 com GPTS observado falha fechado. Toda nova entrada exige fonte normativa, fixture primária, comparação independente PROJ/GDAL e revisão.

Para `EPSG:32620`, valide todos os controles e uma grade da neatline dentro da area of use publicada pelo [registro EPSG](https://epsg.io/32620). A extensão operacional é o bounding box dos vértices da neatline transformados ao CRS nativo: `width = max(easting)-min(easting)` e `height = max(northing)-min(northing)`, ambos em metros. Até a suíte multiescala passar, exija `width ≤100 m` e `height ≤100 m`; diagonal e área não substituem esses dois limites. P1-GEO-TEST compara independentemente fixtures de 100 m, 1 km, 10 km e 100 km, além de amostras próximas aos limites da área. Para cada documento com pelo menos quatro controles não colineares, faça leave-one-out: cada fold ajusta com `N-1` pontos e valida o ponto omitido (com quatro pontos, três ajustam e o quarto é holdout); exija erro máximo geodésico ≤1 m e marque `independentCheck=true`. Esses holdouts verificam consistência do ajuste contra metadado não usado no fold, não exatidão de levantamento do mapa. Com somente três controles, marque `independentCheck=false` e não anuncie erro medido de 1 m. Só expanda o limite de 100 m após fixtures multiescala, revisão independente e atualização explícita desta tabela.

## 2. Contratos e invariantes

A autoridade é packages/contracts/src/pdf.ts. Preservar:

- profile iso-measure-geo, ogc-lgidict ou manual;
- sourceCrs original, pageIndex, CropBox efetivo e rotação 0/90/180/270;
- page points em PDF user space; `controls.ground` e os seis coeficientes do affine no CRS nativo de `sourceCrs`, em ordem cartesiana `[x,y]` e unidade definida no registry;
- `pageToLonLat` e `lonLatToPage` como única fronteira pública WGS84, sempre `[longitude,latitude]`;
- affine com exatamente seis coeficientes;
- residual RMSE, máximo e independentCheck;
- BlobRef máximo 25 MiB, application/pdf;
- apenas JSON no wire payload.

Todos os números são finitos; arrays têm comprimentos válidos; falhas usam códigos determinísticos.

O schema atual de `packages/contracts/src/pdf.ts` já comporta os pares numéricos e `sourceCrs`; esta especificação fixa sua semântica sem mudar a forma do wire contract. Se a implementação exigir outro campo ou outra forma, parar e abrir addendum/revisão do contrato G0.2 antes de alterar os contratos.

### Códigos de erro

`packages/geo/src/pdf/errors.ts` é a autoridade para a união nominal `PdfErrorCode`:

```ts
type PdfErrorCode =
  | 'not-pdf' | 'corrupt-pdf' | 'encrypted-pdf' | 'input-too-large'
  | 'too-many-pages' | 'metadata-limit' | 'unsupported-profile'
  | 'unsupported-crs' | 'inconsistent-crs-controls' | 'ambiguous-viewport'
  | 'invalid-page-geometry' | 'invalid-control-points' | 'degenerate-transform'
  | 'accuracy-check-failed' | 'render-limit' | 'cancelled' | 'deadline-exceeded';
```

Erros de runtime usam esses códigos estáveis; a persistência preenche o `ImportMetadata.errorCode` atual com o código literal. Não persistir texto de exceção, nome de classe PDF.js ou conteúdo do documento.

## 3. Transformação page ↔ ground

1. Resolver referências indiretas e atributos herdados.
2. Obter MediaBox e CropBox efetivos.
3. Normalizar Rotate.
4. Selecionar viewport/moldura.
5. Mapear LPTS para BBox:
   pageX = bbox0 + lptsX * (bbox2-bbox0);
   pageY = bbox1 + lptsY * (bbox3-bbox1).
6. Normalizar controles no CRS nativo declarado pelo registry. Ajustar a transformação page → CRS nativo; **não** reprojetar controles para WGS84 antes do ajuste afim.
7. Converter com proj4 local apenas na fronteira `pageToLonLat`/`lonLatToPage`. `lonLatToPage` faz WGS84 → CRS nativo → inversa afim.
8. Manter CSS zoom/device-pixel-ratio fora da transformação.
9. Rejeitar singularidade, coordenadas não finitas, controles fora da página/neatline e residual independente acima de 1 m quando houver controle independente. Com somente três controles, declarar `independentCheck=false` e não apresentar precisão medida.
10. Para MapLibre, gerar tiles por amostragem inversa WGS84/EPSG:3857 → CRS nativo → página. Imagem de quatro cantos só é permitida se pontos interiores também ficarem dentro de 1 pixel de renderização; fora disso, usar tiles. Nunca esticar cantos de uma página projetada.

Validar affine em cantos e pontos internos. Se o erro exceder o limite, usar rasterização/reprojeção por tiles; não esticar uma imagem.

## 4. Arquivos e APIs

Owner Geo:

- packages/geo/src/pdf/metadata.ts
- packages/geo/src/pdf/iso-measure.ts
- packages/geo/src/pdf/ogc-lgidict.ts
- packages/geo/src/pdf/crs-registry.ts
- packages/geo/src/pdf/errors.ts
- packages/geo/src/pdf/types.ts
- packages/geo/src/pdf/transform.ts
- packages/geo/src/pdf/index.ts

Owner worker:

- apps/admin/src/workers/pdf.worker.ts
- apps/admin/src/lib/pdf/worker-client.ts
- apps/admin/src/lib/pdf/renderer.ts
- apps/admin/src/lib/pdf/tile-cache.ts

Interfaces mínimas do domínio:

    inspectPdf(bytes: Uint8Array, limits: PdfLimits): Promise<PdfInspection>;
    resolveGeoReference(page: PdfPageMetadata, selection?: InsetSelection): GeoReference;
    pageToLonLat(ref: GeoReference, point: PagePoint): LonLat;
    lonLatToPage(ref: GeoReference, point: LonLat): PagePoint | null;
    renderPdfTile(documentId: string, pageIndex: number,
      request: PdfTileRequest, signal: AbortSignal): Promise<RenderedPdfTile>;

`PdfTileRequest` e `RenderedPdfTile` são tipos internos de `apps/admin/src/lib/pdf/worker-client.ts`, não tipos wire de `packages/contracts`. O request contém `scale` finito positivo e retângulo inteiro `{x,y,width,height}` dentro da viewport PDF.js, com largura/altura máximas de 512 px; o resultado contém `ImageBitmap` transferível, página, retângulo e dimensões da viewport. A API também expõe `openPdfDocument(bytes, limits, signal, onProgress)` e `closePdfDocument(documentId)` para enviar os bytes uma única vez e manter a sessão local no worker. `onProgress` reporta estágio, trabalho concluído e total conhecido; nenhum valor contém texto extraído do PDF. `LonLat` é `readonly [longitude, latitude]`, declarado/exportado por `packages/geo/src/pdf/types.ts`. MapLibre consome o tile pelo adapter de `packages/maps`.

Erros explícitos: assinatura, corrupção, criptografia, limite, perfil/CRS, viewport ambígua, transform degenerada, cancelamento e deadline.

O arquivo experimental geopdf-spike.ts permanece referência até substituição revisada.

## 5. Worker, limites e cancelamento

Processar bytes, metadados e render em worker. Limites P1:

- original máximo 25 MiB;
- 100 páginas, rejeitadas assim que PDF.js conclui o parse e antes de abrir/renderizar página;
- no máximo 64 viewports e 8.192 valores de controle geográfico, espelhando os guards P0;
- tile no máximo 512 × 512 px; no máximo um tile render ativo e fila de até 8 requests;
- viewport lógico acima de 16 milhões de pixels nunca vira canvas; é processado somente por tiles visíveis;
- deadline padrão 30 s;
- limites finitos de dicionários/viewports/controles/fila;
- cache derivado limitado a 64 MiB por import e 250 MiB total; LRU só remove tiles regeneráveis, nunca PDF original, controles ou dados locais;
- nenhum request de rede, JavaScript PDF, eval ou URI/fonte externo;
- `requestId` invalida resultados antigos; trabalho invisível/oculto pausa e retoma quando a camada voltar a ficar visível.

Abort/deadline deve cancelar, terminar e recriar o worker quando necessário, liberar canvases, buffers, ImageBitmap e object URLs, e deixar o import recuperável. O primeiro processamento emite progresso por etapa; cancelamento não pode virar ready nem fallback online. Esses limites são tetos da aplicação e não equivalem a um hard cap de memória do navegador; a evidência em dispositivo deve reportar memória observada e sua limitação.

## 6. Dependências, licença e ownership

pdf-lib é parser de objetos PDF. Hoje está em packages/geo como devDependency; o tooling owner move `pdf-lib@1.17.1` para runtime e atualiza lockfile.

PDF.js é usado na versão validada no P0, `pdfjs-dist@6.3.289`, como runtime de render local/worker. O tooling owner fixa a versão exata, configura worker Vite, valida o pacote oficial e target browsers e atualiza `THIRD_PARTY_NOTICES.md`; não copiar árvore vendorizada. Fixar `proj4@2.22.0` (MIT) exatamente em `packages/geo/package.json`; o lockfile observado registra integridade `sha512-MVvH09QrYm3A235rcX39WDiCKanrBiblu28l0KYIn/B2DofmYhvP/LLS43kE66jNDfx/P1l/nah3JmsAq8UgbQ==`. `P1-PDF-RUNTIME` instala com `pnpm install --frozen-lockfile`, verifica que manifest, versão e integridade coincidem e não usa lookup remoto.

MapLibre é propriedade de `packages/maps`. `packages/contracts` tem owner único. Reuso TacMap é limitado a algoritmos de seleção/validação de controles de `GeoPdfParser.kt`, avaliação de registration de `LgiProjection.kt` e álgebra least-squares/inversa de `AffineTransform2D.swift`; adaptar para os tipos TypeScript/CRS do GeoNexo e testar independentemente. Proveniência obrigatória em `docs/maps/geopdf-feasibility.md` e notices: [repositório JediBrooker/TacMap](https://github.com/JediBrooker/TacMap), path relativo de cada fonte, hash SHA-256 da cópia local, hash do `LICENSE`, data de inspeção e commit/tag quando disponível. A árvore do modelo não contém `.git`; registrar `commit unavailable` e não inventar versão. Para a cópia examinada em 2026-09-30: `GeoPdfParser.kt` `F2CE02C33E8DB8C34BEE797A26669A75108A57383E8242C086E11FAF9EB63227`; `LgiProjection.kt` `C9F874B0A0B351CEA45D8F4AC7751374956618720B6607A96FF2CBDC1C0BD4F8`; `AffineTransform2D.swift` `CB347A2D4B66273388BA5E9C7A9E0E0E44C6984DBC962063617AF3B1D419521C`; `LICENSE` `0F8AC4F0B88C8025AD9D10300D6347B7EDC44D1DBF4463D7D2E38B493C3CD4B8`. Incluir o texto MIT integral e copyright Christian Brooker (2026) em notice do GeoNexo se portar trecho substancial. Proibida cópia integral do app iOS/Android, PDFKit, armazenamento ou renderer nativo. PDF.js Apache-2.0 e MapLibre/FlatGeobuf BSD-3-Clause exigem notices quando redistribuídos. `kerilla-map` permanece `REFERENCE_ONLY`.

## 7. Persistência e import

A ingestão durável fica fora do parser:

- apps/admin/src/lib/pdf/import-pdf.ts recebe File e AbortSignal;
- bytes originais entram em IndexedDB antes do processamento;
- hash, blob e estado são separados;
- ready só após inspeção, transform e render válidos;
- PDF comum vira needs-calibration;
- quota, reload e interrupção preservam bytes não sincronizados;
- Neon/Object Storage não é necessário para abrir offline.

Nenhuma escrita Neon é autorizada nesta fase.

## 8. MapLibre

Owner maps implementa overlay e tile protocol:

- attachPdfOverlay com visibilidade, opacidade, página, fit e dispose;
- image source somente se erro interno comprovado;
- raster/tile local para página projetada ou não afim;
- máscara de Neatline e cache por hash/origem/página/transform/versão;
- mesma transformação para seleção e GPS;
- fora da página/neatline não há marcador;
- PDF original imutável.

Não alterar MapLibre ou páginas administrativas antes da revisão independente.

## 9. Testes e QA

Geo/unit: referências indiretas, boxes herdados, rotação, GPTS axis/unidades, registry exato, CRS projetado ajustado em metros, LGIDict Registration/CTM/Neatline, seleção de viewport, singularidade, NaN, round-trip nativo↔WGS84, controle independente, residual acima de 1 m, erro interno, Araguaína fail-closed, corrupção, criptografia, limites e perfis ausentes.

Worker/browser e MapLibre: zero rede, zero PDF JavaScript/eval, deadline, abort, worker teardown, render somente de viewport/tile visível, tile/cache offline, canvas/bitmap integral ausente, progresso do primeiro processamento, pause/resume invisível, Playwright local/mobile, ausência de crash e recursos liberados após cancelar/fechar.

QA independente executa a mesma interação em viewport móvel e aparelho físico disponível; mede pan/pinch, scroll, ações touch, long tasks e memória durante 5 minutos e 20 ciclos de abrir/fechar/render/cancelar. Registra modelo/OS/browser/DPR/GPU, PDF/hash/página, método, medições antes/depois e limitações. O gate falha se PDF bloquear a thread principal com long task ≥50 ms durante pan/pinch, houver canvas de página inteira persistente, crescerem workers/bitmaps/canvases após cleanup, tile offline não for reconstituído ou o usuário não receber progresso/cancelamento. O limite de 50 ms segue a definição de long task da [W3C Long Tasks API](https://www.w3.org/TR/longtasks-1/); registre suporte do browser e use amostragem de frames como complemento. Ausência de aparelho físico ou medição de memória fica PENDING, não PASS. Revisor técnico independente compara pontos/extent com GDAL/PROJ ou fonte primária e verifica axis order, unidade/CRS, CropBox/rotation, inset, orçamento, licenças e ausência de cópia não autorizada.

Comandos separados após implementação:

    pnpm --filter @geonexo/geo test
    pnpm --filter @geonexo/geo typecheck
    pnpm --filter @geonexo/geo lint
    pnpm install --frozen-lockfile

Testes de fixture isolados não autorizam suporte de produção.

## 10. Grafo P1

| ID | Owner | Entrega | Depende de |
|---|---|---|---|
| P1-SPEC-REVIEW | revisor de especificação | aprovar/rejeitar documento e grafo | G0.2, G0.3, G0.5 |
| P1-GEO-API | geo | parser, profiles, CRS allowlist, transform nativo, erros | P1-SPEC-REVIEW |
| P1-GEO-TEST | geo + QA | fixtures, accuracy, Araguaína | P1-GEO-API |
| P1-PDF-RUNTIME | tooling | dependências fixadas, PDF.js worker/Vite, notice/proveniência | P1-SPEC-REVIEW |
| P1-WORKER | worker frontend | sessão local, tile client, limites, progresso, cancelamento | P1-GEO-API, P1-PDF-RUNTIME |
| P1-MAP-OVERLAY | maps | tile protocol/cache local, overlay, pause invisível | P1-GEO-API, P1-WORKER |
| P1-WORKER-QA | QA independente | rede, viewport/tile, cache, mobile, memória, pan/pinch, teardown | P1-WORKER, P1-MAP-OVERLAY |
| P1-LOCAL-IMPORT | persistência frontend | IndexedDB, blob, estado, resume/quota | P1-WORKER, contratos |
| P1-INTEGRATION | integrador root | conectar UI existente | P1-LOCAL-IMPORT, P1-MAP-OVERLAY |
| P1-REVIEW | revisor técnico | arquitetura, matemática, licença/proveniência, segurança, diff | todas anteriores |
| P1-GATE | QA/release | evidência final PASS/FAIL | P1-REVIEW |

Não há dependência de G0.4, Neon, upload remoto ou calibração manual. P3 manual começa após P1-GATE PASS.

## 11. Evidência e stop conditions

P1-GATE exige: tabela exata de profiles/CRS/eixos/unidades; fixtures com hash/URL; erro independente em CRS nativo e residual em metros; Araguaína rejeitado; worker sem rede com limites/cancelamento/progresso; tile/cache local offline; nenhuma bitmap integral persistente; pausa quando invisível; pan/pinch responsivo, sem long task PDF ≥50 ms na interação, 20 ciclos de lifecycle e 5 minutos de medição em viewport móvel; evidência de aparelho físico e memória, ou estado PENDING explícito; original preservado; notices MIT/Apache/BSD e hashes de proveniência; testes, typecheck, lint e revisão independente.

Parar como BLOCKED se renderer local não for provado, APIs não expuserem objetos sem workaround inseguro, CRS/eixos não forem sustentados por fonte primária, Araguaína for aceito, limites/cancelamento não forem demonstráveis, licença/proveniência ficar ambígua, overlay precisar de stretch sem erro comprovado ou surgir dependência de Neon para abrir/renderizar.

Somente o subset testado pode receber PASS; todo o restante fica UNSUPPORTED ou needs-calibration.

## 12. Registro de revisão independente

- **2026-09-30 — P1-SPEC-REVIEW PASS:** revisor independente aprovou perfis e eixos, allowlist e limites CRS, transformação no CRS nativo, holdout leave-one-out, APIs/ownership, cotas do worker, dependências fixadas, reuso MIT atribuído, critérios móveis e grafo acíclico. Os builders podem iniciar somente os escopos P1-GEO-API e P1-PDF-RUNTIME; o limite UTM de 100 m × 100 m permanece até a suíte multiescala e revisão exigidas. Este gate não aprova o produto ou o PRD completo.
