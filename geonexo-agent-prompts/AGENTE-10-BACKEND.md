# GeoNexo — Prompt de Execução do Agente

> Este arquivo é um **prompt operacional**. Ele não substitui os PRDs; ele diz **como executar** os PRDs com segurança, velocidade e sem conflito com os outros agentes.

## Contexto fixo

- Repositório: `geonexo`
- PRDs locais: pasta `instruções/`
- Arquitetura: monorepo `pnpm` + Turborepo
- Aplicação atual: web, sem PWA
- Deploy Vercel: **não fazer agora**
- Login/autenticação: **não fazer agora**
- Validação: tudo deve funcionar localmente primeiro
- Banco: Neon PostgreSQL + PostGIS
- Código: TypeScript strict, pequeno, legível, sem abstrações vazias
- Reutilização: preferir bibliotecas maduras, exemplos oficiais e código compatível com licença
- Não duplicar tipos, regras GIS, contratos ou utilitários já existentes
- Não apagar nem reestruturar trabalho de outro agente para “melhorar” sem necessidade

## Regra de leitura

Antes de editar qualquer arquivo:

1. inspecione o estado atual do repositório;
2. leia `instruções/00-MASTER-PRD.md`;
3. leia `instruções/50-CONTRATOS-DE-INTEGRACAO.md`;
4. leia o PRD específico indicado neste prompt;
5. leia handoffs já existentes;
6. compare o PRD com o código real;
7. implemente somente o que ainda falta.

Se a pasta `instruções/` não for encontrada pelo nome exato, localize a pasta que contém `00-MASTER-PRD.md` e use-a como fonte de verdade.

## Regras de execução

- Não recomece o projeto se já existir scaffold funcional.
- Não substitua biblioteca aprovada sem evidência de problema real.
- Não escreva código “por precaução” para funcionalidades futuras.
- Não use `any` para contornar tipagem.
- Não deixe `TODO` genérico quando puder resolver agora.
- Não exponha segredos.
- Não coloque `DATABASE_URL` no browser.
- Não faça deploy.
- Não adicione autenticação.
- Não implemente PWA.
- Não copie código GPL/AGPL para núcleo proprietário sem autorização/licença compatível.
- Antes de copiar código relevante, confira a licença do repositório/arquivo/commit usado.
- Prefira APIs gratuitas e fontes abertas já aprovadas no PRD.
- Se precisar alterar contrato compartilhado, siga a política de ownership deste prompt.
- Faça mudanças pequenas, coesas e fáceis de revisar.

## Saída obrigatória do agente

Ao terminar, entregue um resumo curto com:

1. **Feito**
2. **Arquivos alterados**
3. **Comandos executados**
4. **Testes/validações**
5. **Pendências reais**
6. **Riscos encontrados**
7. **Dependências para outro agente**
8. **Pronto para merge?** `SIM` ou `NÃO`

Não declare “pronto” se os critérios de aceite do PRD não passaram.

# Função: Backend

## Branch

`agent/backend`

## PRD específico

`instruções/10-BACKEND-VISIONARIO-PRD.md`

Leia também o contrato de integração completo antes de implementar endpoints.

## Pré-condição

Comece apenas depois que `agent/foundation` estiver mergeada na branch base que você recebeu.

## Ownership exclusivo

- `services/api/**`
- `docs/api/**`
- `packages/contracts/**` após a foundation

### Read-only

- `packages/db/**` — Database/Neon é owner
- `packages/maps/**`
- `packages/geo/**`
- `apps/admin/**`

## Missão

Entregar uma API pequena e previsível para:

- health;
- projects;
- layers;
- features;
- operações espaciais necessárias ao primeiro fluxo;
- erros padronizados;
- validação Zod;
- concorrência/versionamento de features;
- integração com `packages/db` sem duplicar schema.

## Regra arquitetural

Prefira:

`route -> validation -> command/query -> db`

Evite camadas cerimoniais:

`route -> controller -> service -> manager -> repository -> helper`

Não crie wrapper que apenas renomeia função de biblioteca.

## Contratos

Você é o owner de `packages/contracts` após a foundation.

- mantenha request/response Zod como fonte de verdade;
- GeoJSON é transporte;
- IDs são UUID opaque strings;
- datas ISO UTC;
- erros usam envelope estável;
- listas potencialmente grandes têm paginação;
- update de feature usa `version` e retorna `409` em conflito.

Antes de mudar contrato, confira consumidores existentes.

## Banco

Não crie migration dentro do backend.

Consuma `packages/db`.
Se faltar tabela/query/schema:
- registre claramente no handoff;
- não duplique schema Drizzle dentro de `services/api`;
- sincronize pelo contrato existente após merge do agente Database.

## Segurança mínima

Mesmo sem auth:

- Zod em toda entrada;
- SQL somente via camada de DB parametrizada;
- body limit;
- CORS local controlado;
- request id;
- logger sem secrets;
- mensagens de erro seguras;
- sem stack trace bruto para cliente.

## Reutilização

Use Hono/Zod/Drizzle conforme definido. Não introduza framework concorrente.

## Critério de aceite

A API deve conseguir, quando a camada DB estiver disponível:

1. criar/listar projeto;
2. criar/listar camada;
3. criar feature GeoJSON;
4. buscar features por camada/bbox conforme PRD;
5. atualizar feature com controle de versão;
6. devolver `409` em versão antiga;
7. deletar/soft-delete conforme contrato definido;
8. responder erros no envelope padrão.

## Validação

Rode no mínimo:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Execute testes de integração disponíveis sem apontar para banco compartilhado destrutivo.
