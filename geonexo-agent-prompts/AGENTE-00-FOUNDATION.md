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

# Função: Foundation / Frontend PRD Handoff

## Branch

`agent/foundation`

## PRD específico

`instruções/20-FRONTEND-PRD-HANDOFF.md`

## Missão

Criar **somente a fundação executável do monorepo** para liberar os demais agentes. Seu objetivo não é construir o produto inteiro.

Você é o único agente que deve rodar antes do paralelismo.

## Ownership

Você pode criar a primeira versão de:

- arquivos raiz do monorepo;
- `apps/admin/`;
- `services/api/` apenas placeholder/health mínimo;
- `packages/*` como packages importáveis;
- `frontend/**`;
- estrutura de docs;
- configs compartilhados.

Depois do seu merge, esses diretórios passam aos owners definidos em `AGENTS.md`.

## Faça

- inicialize `pnpm` workspaces;
- configure Turborepo;
- configure TypeScript strict;
- configure lint/format;
- crie `apps/admin` React + Vite;
- crie shell visual mínimo, sem CRUD completo;
- crie `services/api` com health placeholder isolado;
- crie packages vazios/importáveis conforme PRD;
- prepare aliases consistentes;
- crie scripts raiz mínimos;
- deixe `.env.example` sem segredo real;
- escreva handoff em `frontend/handoff/final-handoff.md`;
- documente arquivos que os outros agentes não devem mover.

## Não faça

- CRUD completo;
- schema real de banco;
- migrations PostGIS;
- lógica GIS completa;
- autenticação;
- deploy;
- Vercel;
- PWA;
- arquitetura excessiva.

## Critério de liberação

Só finalize quando:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

passarem, e existirem:

- admin shell renderizando;
- API health/placeholder;
- packages importáveis;
- aliases funcionais;
- estrutura de contratos;
- handoff claro.

## Meta final

Seu merge deve permitir que os outros seis agentes iniciem sem decidir novamente estrutura, aliases ou tooling.
