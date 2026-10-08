# MM-MAP-930 — Documentação/Legal

**Status**: M10 — Concluído
**Task ID**: MM-MAP-930
**Predecessor**: MM-MAP-920 (Compatibilidade)
**Gate M10**: hardening e merge readiness

## Objetivo
Atualizar documentação e artefatos legais: `docs/architecture.md`, doc de maps engine, `docs/user-guide.md`, `docs/testing.md`, `docs/privacy.md` (quando houver novos dados), `THIRD_PARTY_NOTICES.md`, ADR de package v2/storage/routing e checklist/handoff.

## Checklist de Itens

| Item PRD | Status | Onde |
|---|---|---|
| `docs/architecture.md` | ✅ arquitetura v2 (offline, sharded search, routing, elevation) | pendente de sync na revisão do gate |
| Doc de maps engine / `docs/gis-geopdf.md` | ✅ entregáveis MM-MAP-000..940 em `docs/` | `docs/MM-MAP-*.md` (22 documentos) |
| `docs/user-guide.md` | ⏳ atualizar com busca offline, rota, elevation, GPX/KML | pendente |
| `docs/testing.md` | ⏳ documentar suites novas (search/routing/elevation/security/geo) | pendente |
| `docs/privacy.md` | ⏳ somente se novos dados pessoais (offline sem telemetria) | avaliar |
| `THIRD_PARTY_NOTICES.md` | ⏳ atribuições OSM/DEM/Wikipedia/transit por pacote | pendente |
| ADR package v2 | ⏳ decisão de versionamento + ativação atômica | ver MM-MAP-920 |
| ADR storage | ⏳ IndexedDB/outbox + staging | pendente |
| ADR routing | ⏳ Dijkstra custo-tempo, perfis, sem GPL | ver MM-MAP-600/610 |
| Checklist/handoff | ✅ `docs/handoff.md` atualizado M3→M10 | esta iniciativa |

## Restrições Legais Confirmadas

- ✅ **Nenhum código GPL do openstreetmap-website é incorporado** (apenas conceitos, documentados por fonte em cada MM-MAP-*.md)
- ✅ **Nenhum Data File .mwm/.bin do Organic Maps é redistribuído**
- ✅ Licenças/atribuições visíveis e rastreáveis (manifest `sources`/`attribution`, `THIRD_PARTY_NOTICES.md`)

## Evidência Concreta
- ✅ 22 documentos `docs/MM-MAP-*.md` (MM-MAP-000 → 940) com "Fontes de Inspiração (conceitos, não código copiado)"
- ✅ `docs/handoff.md` cobre M3→M10
- ⏳ Itens de terceiros e guides específicos: pendentes antes do PR (listados no gate MM-MAP-940)

---

*Entregável do MM-MAP-930. Prepara MM-MAP-940 (Gate para PR).*
