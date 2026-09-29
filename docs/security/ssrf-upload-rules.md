# Regras SSRF / Upload / XSS-geo — obrigação pré-feature (PRD 30)

> Estas regras devem estar implementadas **antes** das rotas que as exigem.
> Hoje nenhuma dessas rotas existe; este arquivo é o contrato que backend/frontend/GIS devem seguir.

## 1. SSRF — `import.source` e qualquer URL externa (P1 futuro)

Proibido nesta fase: qualquer fetch server-side de URL arbitrária enviada pelo cliente.

Quando a rota de import existir, aplicar **tudo**:

1. Contrato (`packages/contracts/src/import.ts`, owner compartilhado — propor via handoff):
   ```ts
   const BLOCKED = /localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|metadata/i;
   source: z.string().url().refine(
     (u) => u.startsWith('https://') && !BLOCKED.test(new URL(u).hostname + new URL(u).href),
     { message: 'SOURCE_NOT_ALLOWLISTED' },
   );
   ```
2. Allowlist de hosts por provedor (IBGE, INPE/TerraBrasilis, Nominatim) — nunca `http:`, nunca IP literal, nunca porta não-padrão.
3. Fetch server-side com `timeout` ≤ 10s, `redirect: manual` com limite ≤ 3 e revalidação do host a cada hop, teto de corpo (~5 MB).
4. Nominatim: via proxy backend, `User-Agent` identificando o projeto, 1 req/s, cache; nunca autocomplete direto do browser.
5. Nunca interpolar URL do usuário em comando shell, `ST_*` dinâmico ou nome de arquivo.

## 2. Uploads futuros — arquivo é hostil (P1 futuro)

Antes da primeira rota de upload:

- Limites: arquivo ≤ 25 MB, descompressão ≤ 100 MB, features ≤ 10.000, timeout de parse ≤ 30s.
- Tipo: validar extensão **+ magic bytes**; rejeitar disfarce (`.geojson` com conteúdo zip/exe).
- Zip: anti zip-bomb (taxa e total), anti path-traversal (`../`, absoluto, symlink) — extrair só basenames para diretório fora de `public/`.
- Conteúdo: todo GeoJSON passa pelo `createFeatureSchema` (após tetos da §4); rejeitar `properties` com profundidade > 3 ou > 50 chaves.
- Armazenamento: fora da árvore servida; servir só via rota autenticada (futura) com `Content-Type` fixo e `Content-Disposition: attachment` quando aplicável.

## 3. XSS em conteúdo geoespacial (P2 futuro)

- Popup/legendas: apenas nós de texto (`textContent`) ou `maplibre` `setDOMContent(elemento)`; **nunca** `setHTML`, `innerHTML`, `dangerouslySetInnerHTML`.
- Links vindos de `properties`: validar esquema `https:` antes de renderizar; `target="_blank"` sempre com `rel="noopener noreferrer"`.
- Quando o popup existir, adicionar `escapeHtml()` (~10 linhas) **no ponto de render** (owner mapas), não como util global prematuro.
- Reavaliar após upgrade do maplibre-gl (GHSA-jrc7-96c5-q579).

## 4. Tetos de validação a aplicar no contrato (P3 futuro, antes das rotas de escrita)

- `positionSchema`: longitude `-180..180`, latitude `-90..90` (server-side; o gate client-side em `packages/geo` é burlável).
- `name`: `.min(1).max(200)`; `description`: `.max(2000)`.
- `properties`: `z.record(z.unknown())` com cap (≤ 50 chaves, valores ≤ 2 KB, profundidade ≤ 3).
- `bodyLimit` ~1 MB nas rotas `POST/PATCH` (`hono/body-limit`), antes do parse Zod.
- Paginação: reduzir `MAX_PAGE_LIMIT` 1000 → 100–200 quando as rotas de lista existirem.
- `BasemapRegistry.register()`: aceitar só `https:` com host em allowlist configurável.
