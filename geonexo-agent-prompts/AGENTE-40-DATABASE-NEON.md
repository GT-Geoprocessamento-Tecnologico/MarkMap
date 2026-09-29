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

# Função: Database / Neon / PostGIS

## Branch

`agent/database`

## PRDs base

Use principalmente:

- `instruções/10-BACKEND-VISIONARIO-PRD.md` — seções de schema, PostGIS, migrations e Neon;
- `instruções/00-MASTER-PRD.md`;
- `instruções/50-CONTRATOS-DE-INTEGRACAO.md`;
- `instruções/40-QUALIDADE-VISIONARIO-PRD.md` para estratégia de testes com PostGIS real.

## Pré-condição

Comece após merge da foundation.

## Ownership exclusivo

- `packages/db/**`
- migrations
- `docs/database/**`
- scripts de banco exclusivos em `infra/`

### Read-only

- `services/api/**`
- `apps/admin/**`
- `packages/maps/**`
- `packages/contracts/**`

## Missão

Entregar a camada espacial persistente do GeoNexo no Neon/PostGIS, com migrations reproduzíveis, queries mínimas e sem esconder PostGIS atrás de abstrações desnecessárias.

## Banco

- Neon PostgreSQL;
- PostGIS obrigatório;
- `pgcrypto` se usado pelo schema;
- Drizzle para schema/migrations onde aplicável;
- migrations versionadas no Git são fonte de verdade.

## Ambiente

Não use produção.

Preferência:
- branch Neon de desenvolvimento;
- connection string somente server-side;
- `.env` local fora do Git;
- `.env.example` sem valor real.

Se Neon ainda não estiver ligado ao repo, documente passos e bloqueios; não invente credenciais.

## Schema

Implemente o schema mínimo do PRD:

- projects;
- maps se exigido pelo PRD atual;
- layers;
- features;
- map_sources quando entrar no milestone;
- imports quando entrar no milestone;
- audit_events base.

Para `features`:
- geometry PostGIS com SRID canônico definido no PRD;
- properties JSONB;
- version para optimistic concurrency;
- timestamps;
- índices espaciais e relacionais justificados.

Não crie 20 tabelas “para o futuro”.

## PostGIS

Migrations idempotentes para extensões conforme PRD.

Use índice GiST onde query espacial real exigir.

Valide:
- SRID;
- geometry válida conforme política do PRD;
- round-trip GeoJSON <-> PostGIS;
- bbox query;
- insert/update;
- conflict/version fields.

## Queries

Exponha funções pequenas em `packages/db`, por exemplo:

- create/list/get project;
- create/list layer;
- create/list/get/update feature;
- list features por layer/bbox;
- audit insert quando definido.

Não crie repository genérico universal.

## Neon

Pensando à frente:

- dev branch agora;
- branch por PR/teste futuramente;
- não automatizar Vercel;
- não automatizar produção;
- documentar restore/branching sem implantar automação desnecessária.

## Critério de aceite

- migrations sobem do zero;
- PostGIS está habilitado;
- schema Drizzle corresponde ao banco;
- índice espacial existe quando necessário;
- round-trip de Polygon mantém geometria;
- `version` suporta conflito;
- testes de integração podem rodar contra PostGIS real;
- nenhuma query de browser recebe connection string;
- rollback básico está documentado.

## Validação

Rode migrations e testes em ambiente dev/teste seguro.

Depois:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

No handoff, informe exatamente quais migrations foram aplicadas e como reproduzir do zero.
