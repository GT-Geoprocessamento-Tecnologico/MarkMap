# MM-MAP-920 — Compatibilidade (Package v1 → v2)

**Status**: M10 — Concluído
**Task ID**: MM-MAP-920
**Predecessor**: MM-MAP-910 (Segurança)
**Gate M10**: hardening e merge readiness

## Objetivo

Garantir migração/convivência de package v1 → v2, que app antigo não ative package incompatível, que app novo não apague package antigo antes de confirmar o novo, que o schema local preserve workspace/outbox e que o rollback esteja documentado.

## Decisões de Compatibilidade

| Requisito PRD                                             | Decisão                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Migração v1 → v2 **ou** convivência                       | **Convivência com versionamento**: `packageVersion` + `minimumCompatibleVersion` no manifest v2    |
| App antigo não ativa package incompatível                 | Manifest v2 tem campos obrigatórios novos; validador v1 rejeita → app antigo não ativa             |
| App novo não apaga package antigo antes de confirmar novo | Ativação **atômica**: staging → validação completa → troca; pacote antigo só removido após sucesso |
| Schema local preserva workspace/outbox                    | Migração de IndexedDB é aditiva (novos stores/índices); `workspace`/`outbox` intactos              |
| Rollback documentado                                      | Ver abaixo                                                                                         |

## Versionamento do Manifest

```jsonc
{
  "packageVersion": "1.0.0",
  "minimumCompatibleVersion": "1.0.0",
  "osmDataDate": "2026-09-30T00:00:00.000Z",
  "capabilities": [],
  "checksums": { "archive": "..." },
  "totalBytes": 4300633,
  "sources": { "osm": "OpenStreetMap", "attributions": [] },
}
```

- **App** compara `minimumCompatibleVersion` com sua versão de schema.
- **App antigo** (schema v1) falha no `safeParse` por campos ausentes → não ativa (comportamento desejado).
- **App novo** aceita v1?? Não: v1 é detectado pela ausência de `packageVersion` e tratado com caminho de compatibilidade documentado (ler v1 sem migrar destrutivamente).

## Ativação Atômica (não destrutiva)

1. Download para staging (store separado).
2. Validação completa (manifest, checksum, PMTiles header, limites).
3. Troca do ponteiro ativo para o novo pacote.
4. **Só então** remove o pacote anterior.
5. Falha em qualquer etapa → descarta staging, mantém pacote atual.

## Rollback

1. Manter pacote anterior até confirmação do novo (janela de rollback).
2. Rollback = repontear para o pacote anterior (não requer download).
3. Se IndexedDB local foi migrado, a migração é aditiva → rollback do app não perde dados.
4. Documentado em `docs/architecture.md` (MM-MAP-930).

## Evidência Concreta

- ✅ `packageVersion` + `minimumCompatibleVersion` no manifest v2
- ✅ Ativação atômica (staging → validação → troca → cleanup)
- ✅ Fixture `manifest.json` atualizada com campos v2 (validação v2)
- ✅ App antigo rejeita v2 por schema (evidência: fixture v2 exige campos novos)
- ✅ Workspace/outbox preservados (migração aditiva)
- ⏳ Rollback detail → `docs/architecture.md` (MM-MAP-930)

---

_Entregável do MM-MAP-920. Prepara MM-MAP-930 (Documentação/legal)._
