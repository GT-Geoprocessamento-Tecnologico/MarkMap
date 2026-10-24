---
project: MarkMap
type: agent-memory-protocol
status: proposed
version: "1.0"
created_at: "2026-10-24T19:43:34-03:00"
created_by: "ChatGPT (agente documental; OpenAI)"
source: "Pedido explicito do responsavel em conversa MarkMap, 2026-10-24"
timezone: America/Araguaina
---

# MarkMap — Protocolo obrigatorio de memoria e rastreabilidade

**Autor do registro:** ChatGPT (agente documental, OpenAI). **Data/hora da criacao:** 2026-10-24T19:43:34-03:00 (`America/Araguaina`). **Escopo:** somente `mmatteuus/MarkMap`. A proposta vive nesta branch ate revisao/merge autorizados; apos merge, AGENTS.md sera a porta de entrada oficial do repositório.

## 1. Onde cada agente encontra o cerebro

O **Obsidian e externo ao repositorio**: conectar o app/plugin `OBSIDIAN_LOCAL_MTS` ao vault do responsavel. **Nao existe garantia de acesso automatico de todo agente em qualquer plataforma**. Nao criar um segundo cerebro nao sincronizado dentro do Git.

| Funcao | Fonte oficial |
|---|---|
| Indice Obsidian do projeto | `02-PROJECTS/MARKMAP.md` |
| **Inicio obrigatorio** | `02-PROJECTS/MARKMAP/00-INICIO-AQUI.md` |
| Fonte consolidada | `02-PROJECTS/MARKMAP/MARKMAP-FONTE-PRINCIPAL.md` |
| Handoff vivo | `02-PROJECTS/MARKMAP/01-HANDOFF-VIVO.md` |
| Checklist operacional | `02-PROJECTS/MARKMAP/02-CHECKLIST-OPERACIONAL.md` |
| Diario append-only | `02-PROJECTS/MARKMAP/14-DIARIO-DE-EXECUCAO.md` |
| **Norma vinculante** | `02-PROJECTS/MARKMAP/25-PROTOCOLO-OBRIGATORIO-DE-RASTREABILIDADE.md` |
| Modelo no Obsidian | `02-PROJECTS/MARKMAP/26-MODELO-REGISTRO-DE-AGENTE.md` |
| Modelo no Git | [agent-memory-entry-template.md](agent-memory-entry-template.md) |
| Checklist **vivo** | [Notion MarkMap](https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204) |
| Codigo e trabalho paralelo **vivos** | [GitHub MarkMap](https://github.com/mmatteuus/MarkMap) — HEAD, PRs, issues e AGENTS.md |

**CONSUBOV e um projeto diferente.** Seu repo e vault nao podem fornecer requisitos, memoria ou resultados de teste ao MarkMap. O nome antigo do MarkMap pode existir em identificadores tecnicos historicos (bancos/cache/objetos) e nao deve ser renomeado por estetica.

## 2. Sequencia obrigatoria de trabalho

### ANTES de alterar qualquer coisa

1. Identificar o projeto: so MarkMap; nunca misturar outro produto.
2. Ler Obsidian, na ordem `00-INICIO-AQUI`, `MARKMAP-FONTE-PRINCIPAL`, `01-HANDOFF-VIVO`, `02-CHECKLIST-OPERACIONAL`, `25-PROTOCOLO...`, depois a nota tematica e PRD.
3. Consultar o **Notion atual**, HEAD GitHub `main` e branch do trabalho, PRs/issues abertos, autores/agentes e diffs nao incorporados; verificar tarefas em andamento e evitar duplicacao.
4. Para mudancas de codigo, classificar o estado existente: **FUNCIONA / PARCIAL / QUEBRADO / NAO IMPLEMENTADO**, fundamentando em arquivo, teste ou observacao, sem tratar plano como implementacao.
5. Registrar quando cada fonte foi consultada e por qual agente. Se uma fonte estiver indisponivel, marcar **NAO VERIFICADO** e nao inventar um HEAD/resultado.

### DURANTE

- Fazer somente o escopo autorizado e manter evidencias (arquivo, branch, SHA, URL, teste, comando, logs saneados).
- Preservar IndexedDB/outbox/GeoPDF/mapas, workspace e estado offline; nao alterar producao, billing, releases, tags ou merges sem autorizacao explicita.
- Preservar historico de outros agentes; nao reescrever logs antigos, nem fazer force push.
- Nao copiar secrets, tokens, dados produtivos, PDFs privados ou informacoes pessoais para notas.

### **DEPOIS DE TODA MUDANCA RELEVANTE** — obrigatorio

Uma mudanca relevante inclui: codigo, PR, issue, teste ou QA, bug, configuracao, documentacao, regra, arquitetura, decisao, risco/bloqueio, schema, sync, release, deploy, permissao ou faturamento.

1. Escrever registro com **data/hora/autor** no `14-DIARIO-DE-EXECUCAO.md` (append-only), usando modelo e referencias. **Mesmo quando o resultado for falha ou bloqueio.**
2. Atualizar `01-HANDOFF-VIVO.md`: estado verdadeiro, objetivo, alteracoes, ambiente/branch/SHA, riscos e **proxima acao**.
3. Atualizar `02-CHECKLIST-OPERACIONAL.md`: concluido vs parcial vs bloqueado vs nao executado, sem fingir que teste isolado = gate completo.
4. Atualizar nota tecnica respectiva; vincular PRD/issue/commit/evidencia.
5. Se mudou fase, decisao, backlog, blocker, arquitetura ou proximo passo, registrar no **Checklist Mestre Notion** e na **issue/PR GitHub** pertinente, com proveniencia e timestamp.
6. **Reler** Obsidian e as fontes escritas, confirmar que o registro aparece. No relatorio final declarar `MEMORIA: ATUALIZADA` somente apos leitura bem-sucedida.

**Se o agente nao conseguir acessar/gravar Obsidian:** declarar `MEMORIA: PENDENTE — conector indisponivel`; manter registro pronto na issue/PR ou Notion com hora, autor, acao, links e passos de reconciliacao. Nao afirmar sincronizacao nem usar o bloqueio como justificativa para contornar gates. Depois que o conector voltar, reconciliar antes de marcar concluido.

## 3. Norma para data, horario, autor e origem

Usar timestamp **ISO 8601 com offset**, por exemplo `2026-10-24T19:43:34-03:00`. Timezone preferencial para o projeto: `America/Araguaina`, desde que seja o fuso verdadeiro da operacao; outros fusos devem estar explicitados corretamente.

**Obrigatorio em registro novo e cada atualizacao:**

| Campo | Significado |
|---|---|
| `record_id` | Identificador unico, ex. MARKMAP-20261024T194334-CHATGPT-PR44 |
| `recorded_at` | Data **e hora** quando se escreveu o registro, com offset |
| `recorded_by` | Autor que realizou a anotacao, plataforma/agente (nao identidade imaginada) |
| `event_at` / `event_author` | Data/hora e autor do evento **se verificados**; senao `nao verificado` |
| `source_system` / `source_ref` | Sistema e URL/caminho identificavel |
| `source_checked_at` | Quando a origem foi lida, ISO 8601 com offset |
| `repo`, `branch`, `commit_sha` | Repo e estado **verificados** para mudancas de codigo; senao nao aplicavel |
| `scope`, `files_affected`, `action` | O que efetivamente mudou |
| `status` / `validation` | FEITO/PARCIAL/BLOQUEADO/NAO EXECUTADO, comandos e PASS/FAIL/BLOCKED |
| `risks` / `next_step` | Limitacoes, dependencias, proxima acao |
| `links` | Obsidian, Notion, issue/PR, logs sem secrets e evidencias |

**Frontmatter das notas novas:** `project: MarkMap`, `type`, `created_at`, `created_by`, `updated_at`, `updated_by`, `source_ref`, `source_checked_at`, `status`, `timezone`. Ao alterar, conservar `created_*`, atualizar `updated_*` e acrescentar log datado.

**Legado:** nao fabricar autor/horario original. Para registros anteriores com metadados ausentes escrever `event_author: nao verificado` e `event_at: nao verificado`, e registrar `reviewed_by`/`reviewed_at` apenas como evidencia da revisao. Timestamp da verificacao nunca substitui a data de origem.

## 4. Formato de saida do agente

```text
RESULTADO:
BRANCH/COMMIT:
ALTERACOES:
VALIDACAO: (PASS/FAIL/BLOCKED + ambiente + log)
REGISTRO: (data/hora/fuso e autor do registro)
FONTES: (URLs/paths e data da consulta)
RISCO/PENDENCIAS:
PROXIMO PASSO:
MEMORIA: ATUALIZADA (Obsidian/Notion/GitHub verificados) ou PENDENTE (motivo)
```

Ninguem pode afirmar `CONCLUIDO` se o gate obrigatorio nao rodou ou se um requisito de rastreabilidade estiver bloqueado. A mudanca tecnica pode estar completa com **MEMORIA PENDENTE**, mas isso fica explicito ate a regularizacao.

## 5. Verificacao de conformidade e seguranca

- Confirmar que `AGENTS.md` contem o caminho do cerebro e links para este protocolo e modelo.
- Confirmar conexao ao **vault correto**; busca deve ser restrita a `02-PROJECTS/MARKMAP`.
- Confirmar autoria e hora reais de novas entradas, referencia de fonte e estado do SHA/branch.
- Confirmar Obsidian diario/handoff/checklist e Notion/PR quando aplicavel com **read-back**, registrando impedimentos.
- NAO efetuar mudancas em CONSUBOV, outros repositorios, gastos GitHub Actions, IndexedDB, Neon, deploy, release, migracoes destrutivas ou merge sem autorizacao.
- Aderir ao `AGENTS.md` restante, `docs/versioning.md`, PRDs e testes exigidos, sem modificar stack.

**Proveniência desta regra:** pedido do responsavel na conversa MarkMap em 2026-10-24. Compilado por ChatGPT (agente documental; OpenAI) em 2026-10-24T19:43:34-03:00. Para atualizar o texto, registrar alteracao com data/hora/autor no Obsidian e GitHub; nao apagar versoes anteriores sem controle.
