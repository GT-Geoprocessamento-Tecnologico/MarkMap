---
project: MarkMap
type: agent-record-template
status: proposed
version: "1.0"
created_at: "2026-10-24T19:43:34-03:00"
created_by: "ChatGPT (agente documental; OpenAI)"
timezone: America/Araguaina
source: "Pedido explicito do responsavel, conversa MarkMap em 2026-10-24"
---

# MarkMap — modelo de registro com rastreabilidade

**Este e um modelo; datas, autores e SHA de exemplo NAO sao fatos de outro evento.** Antes de registrar, buscar a hora real do executor e verificar cada origem. Autor do registro e autor do evento sao pessoas/funcoes potencialmente diferentes.

```markdown
### MARKMAP-<YYYYMMDDTHHMMSS>-<AGENTE>-<ID> — <assunto>
- record_id:
- recorded_at: <ISO 8601 com offset, ex. 2026-10-24T19:43:34-03:00>
- timezone: <America/Araguaina ou timezone real>
- recorded_by: <agente/plataforma/autoria real>
- event_at: <ISO 8601 comprovado | nao verificado>
- event_author: <identidade comprovada | nao verificado>
- source_system: <GitHub | Notion | Obsidian | testes | relato>
- source_ref: <URL, path, PR, issue, log>
- source_checked_at: <ISO 8601 com offset>
- repo: mmatteuus/MarkMap (verificar URL e SHA atuais)
- branch: <branch verificada | nao aplicavel>
- commit_sha: <SHA exato | nao aplicavel>
- prd_issue: <URL ou nao aplicavel>
- scope:
- files_affected:
- action: <feito efetivamente>
- status: FEITO | PARCIAL | BLOQUEADO | NAO EXECUTADO
- validation: <comandos/ambiente/PASS/FAIL/BLOCKED/log>
- not_run: <gates nao executados e motivo>
- risks:
- next_step:
- memory_proof: <links de Obsidian, Notion, PR e data/hora da leitura posterior>
```

Frontmatter para nota **nova** (substituir os valores ao criar):

```yaml
---
project: MarkMap
type: handoff
status: active
created_at: "2026-10-24T19:43:34-03:00"
created_by: "ChatGPT (agente de exemplo)"
updated_at: "2026-10-24T19:43:34-03:00"
updated_by: "ChatGPT (agente de exemplo)"
source_system: github
source_ref: "https://github.com/mmatteuus/MarkMap"
source_checked_at: "2026-10-24T19:43:34-03:00"
timezone: America/Araguaina
---
```

**Nunca inventar autor/data original de nota antiga:** usar `nao verificado`, e quando revisar registrar `reviewed_by` e `reviewed_at` com hora verdadeira. Nao copiar secrets/PII/dados reais do workspace. O log pertence somente ao MarkMap.

**Onde inserir:** Diario `02-PROJECTS/MARKMAP/14-DIARIO-DE-EXECUCAO.md` (append-only); consolidar Handoff `01-HANDOFF-VIVO.md`, Checklist `02-CHECKLIST-OPERACIONAL.md` e nota tecnica. Sincronizar [Notion](https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204) e issue/PR quando relevante. Ao terminar, **reler as notas** e declarar `MEMORIA: ATUALIZADA` ou `PENDENTE` com motivo.
