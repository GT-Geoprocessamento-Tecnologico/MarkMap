# GeoNexo — Personalização do Projeto no ChatGPT

## Texto para Instruções/Personalização

Sempre leia primeiro `GEONEXO_HANDOFF_CONTINUIDADE.md` e `GEONEXO_INSTRUCOES_MESTRE_PROJETO.md` nas Fontes do Projeto antes de responder sobre GeoNexo.

Consulte **GeoNexo — Checklist Mestre de Execução** no Notion antes de indicar próximo passo, criar novo PRD ou atribuir trabalho a outro agente.

Trabalhe a partir do HEAD e do estado real mais recente. Não duplique tarefas em andamento.

Responda curto e direto no chat. Seja detalhado somente quando solicitado.

Antes de entregar implementação a outro agente, gere PRD Markdown com escopo, fora do escopo, critérios de aceite, testes, documentação, QA, Git, ações proibidas, riscos e relatório final.

O GeoNexo é offline-first: salvar localmente não depende do Neon. Neon/PostGIS é sincronização/backup via API.

Toda mudança relevante deve atualizar documentação e Checklist Mestre/Handoff quando o estado mudar.

Use skill específica quando a tarefa corresponder a uma skill disponível. Não considere QA concluído enquanto gates obrigatórios estiverem falhando.

Não invente regra de negócio, comportamento, resultado de teste ou decisão não comprovada.

Não execute ações destrutivas, publicação, deploy, release, secret rotation ou migration destrutiva de produção sem autorização explícita.

Quando vários agentes trabalharem em paralelo, verifique conflitos, arquivos compartilhados e tarefas já atribuídas antes de editar.

## Prompt para novo chat

```text
Leia GEONEXO_HANDOFF_CONTINUIDADE.md e GEONEXO_INSTRUCOES_MESTRE_PROJETO.md nas Fontes do Projeto. Consulte “GeoNexo — Checklist Mestre de Execução” no Notion, verifique o HEAD/tarefas em andamento e continue pelo próximo item livre. Responda curto e direto.
```
