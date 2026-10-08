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
| `docs/architecture.md` | ✅ seção "Maps Engine v2 offline" adicionada (diagrama, módulos, ADRs) | `docs/architecture.md` |
| Doc de maps engine / `docs/gis-geopdf.md` | ✅ entregáveis MM-MAP-000..940 em `docs/` | `docs/MM-MAP-*.md` (22 documentos) |
| `docs/user-guide.md` | ✅ seções 9–13: pacotes offline, busca, rota/navegação, elevação, import GPX/KML | `docs/user-guide.md` |
| `docs/testing.md` | ✅ seção "Maps Engine v2 offline" com tabela de suítes e gate | `docs/testing.md` |
| `docs/privacy.md` | ✅ avaliação por recurso: nenhuma categoria pessoal nova | `docs/privacy.md` |
| `THIRD_PARTY_NOTICES.md` | ✅ seção de fontes de dados (OSM/DEM/Wikipedia/transit) + origem de código inspirado | `THIRD_PARTY_NOTICES.md` |
| ADR package v2 | ✅ ADR-0004 (versionamento + ativação atômica) | `docs/adr/0004-pacote-regional-v2-ativacao-atomica.md` |
| ADR storage | ✅ ADR-0005 (LargeBlobStore multi-backend + DeviceStorageProfile) | `docs/adr/0005-storage-regional-largeblobstore.md` |
| ADR routing | ✅ ADR-0006 (Dijkstra custo-tempo, perfis, sem GPL) | `docs/adr/0006-roteamento-offline-dijkstra-custo-tempo.md` |
| Checklist/handoff | ✅ `docs/handoff.md` atualizado M3→M10 | esta iniciativa |
| ADR index | ✅ `docs/adr/README.md` com 0001–0006 | `docs/adr/README.md` |

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
