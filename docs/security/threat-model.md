# GeoNexo — Threat Model (MVP local, sem auth/deploy/PWA)

Data: 2026-09-28 · Branch: `agent/security` · PRD: `INTRUÇÕES/geonexo-prds/30-SEGURANCA-VISIONARIO-PRD.md`

## Escopo e trust boundaries

```
browser (admin localhost:5173)
  -> API Hono (127.0.0.1:3000, sem auth nesta fase)
  -> Neon/PostGIS via DATABASE_URL (server-side apenas)
```

Integrações planejadas (todas via adapter backend, nunca fetch direto do browser):
basemap (OpenFreeMap) · geocoder (Nominatim, 1 req/s + cache) · INPE/IBGE/TerraBrasilis · futuros uploads/imports.

Fora de escopo nesta fase: login, deploy Vercel, PWA (não implementar "por segurança").

## Matriz de risco

Legenda: **ATUAL** = explorável hoje · **FUTURO** = vira risco quando a feature existir.
P0 bloqueia release · P1 24h · P2 próxima sprint · P3 backlog.

| # | Ameaça | Ator → Vetor → Impacto | Sev | Atual/Futuro | Status 2026-09-28 |
|---|--------|------------------------|-----|--------------|-------------------|
| T1 | Segredo commitado (DATABASE_URL, token, senha) | dev/CI → `.env*`/compose/history → takeover do banco | P0 | ATUAL | Mitigado no código próprio (nenhum segredo real encontrado; `.gitignore` endurecido; compose externalizado). **Pendente:** varredura do histórico (`git log -p -S`, gitleaks) |
| T2 | Credencial fraca dev reutilizada em ambiente compartilhado | operador → copia `geonexo/geonexo` → acesso ao banco | P1 | ATUAL como padrão | Parcialmente mitigado (compose aceita `${POSTGRES_PASSWORD}`/`${DATABASE_URL}`); rotação obrigatória antes de qualquer ambiente compartilhado |
| T3 | SSRF via `import.source` (URL arbitrária server-side) | usuário → `POST /imports {source}` → leitura de intranet/metadata `169.254.169.254` | P1 | FUTURO (sem rota consumidora hoje) | Aberto — regra em `ssrf-upload-rules.md`; aplicar allowlist+refine no contrato antes da rota existir |
| T4 | SQL injection via identificadores no drizzle-orm 0.35.3 (GHSA-gpj5-g38j-94v9, fix ≥0.45.2) | usuário → entrada geoespacial → query manipulada | P1 | FUTURO (sem SQL hoje; só deps declaradas) | Aberto — upgrade ownership backend/db antes do primeiro CRUD |
| T5 | XSS em `properties` GeoJSON renderizado em popup | dado importado → popup com HTML → execução de JS no browser da vítima | P2 | FUTURO (zero `innerHTML`/`dangerouslySetInnerHTML` hoje) | Aberto — regra: `textContent`/`setDOMContent`, nunca `setHTML`; helper `escapeHtml` no ponto de render |
| T6 | XSS sanitizer bypass no maplibre-gl 4.7.1 (GHSA-jrc7-96c5-q579, fix ≥6.4.1) | idem T5 via `DOM.sanitize()` | P1 | FUTURO | Aberto — upgrade ownership frontend/mapas |
| T7 | Headers de segurança ausentes | rede → clickjacking/sniffing | P2 | ATUAL baixo (localhost) | Mitigado na API (`secureHeaders()` em `services/api/src/app.ts`); CSP do admin fica para o deploy |
| T8 | CORS wildcard/malformado | operador → `CORS_ORIGINS=*` → site malicioso chama a API | P2 | ATUAL | Mitigado (`env.ts` rejeita `*` e origem malformada, fail-closed) |
| T9 | Body gigante (GeoJSON `properties` sem teto) → DoS | usuário → POST sem limite | P2 | FUTURO (sem rota POST hoje) | Aberto — `bodyLimit` ~1 MB nas futuras rotas de escrita + tetos no contrato |
| T10 | Validação frouxa (coordenadas sem range, strings sem `.max()`, `properties` sem cap) | usuário → dado impossível/poluição | P3 | FUTURO | Aberto — ranges/tetos no contrato antes das rotas de escrita |
| T11 | Vite 5.4.21 com CVEs (fs.deny bypass, path traversal, NTLMv2) | rede local/dev → leitura de arquivo | P2 | ATUAL dev-only | Aberto — upgrade ownership frontend |
| T12 | Vitest <3.2.6 file-read + path traversal (dev-only) | processo local | P3 | ATUAL dev-only | Aberto — upgrade na próxima janela de deps |
| T13 | esbuild ≤0.24.2 (dev server aceita request cross-site) | site malicioso → dev server | P3 | ATUAL dev-only | Aberto — sobe junto com o Vite |
| T14 | `REPOSITORIOS MODELOS/` dentro do git (AGPL/GPL + `private.pem` demo + bloat) | dev → copy-paste acidental contamina núcleo proprietário | P2 | ATUAL | Aberto — mover para fora do repo/submódulo (decisão com mantenedor) |
| T15 | Sem `LICENSE` raiz | — → distribuição sem base jurídica | P2 | ATUAL | Aberto — criar antes de distribuir |
| T16 | Logs com PII/segredo | código → log → vazamento | P3 | ATUAL | Mitigado (`logger.ts` só metadados; teste anti-vazamento em `api.test.ts`) |
| T17 | Error leakage (stack/connection string) | erro → resposta HTTP | P3 | ATUAL | Mitigado (`error-handler.ts` genérico + teste) |

## Controles já verificados (PASS)

- CORS allowlist sem wildcard · envelope de erro único · `/health` expõe só `configured|not_configured`
- `DATABASE_URL` lida só em `services/api/src/env.ts`, zero ocorrência no browser
- Queries: nenhuma SQL escrita ainda (drizzle/postgres só declarados); diretriz "nunca concatenar" registrada
- Popup: nenhum sink HTML hoje (`controller.ts` passa GeoJSON como objeto)

## P0 conhecido? **Não** — nenhum segredo real/produtivo, RCE, bypass de auth ou vazamento ativo encontrado no código próprio nem nos 4 commits do histórico (pickaxe + grep de alta entropia, ver `dependency-audit-2026-09-28.md`).
