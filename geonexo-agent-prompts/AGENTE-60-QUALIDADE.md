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

# Função: Qualidade / Testes

## Branch

`agent/quality`

## PRD específico

`instruções/40-QUALIDADE-VISIONARIO-PRD.md`

## Pré-condição

Comece após a foundation. Rebase/atualize sua base quando backend/GIS/frontend disponibilizarem os fluxos que seus testes precisam.

## Ownership

- `e2e/**`
- testes compartilhados
- configs Vitest/Playwright
- `.github/workflows/**` quando o PRD liberar CI
- `docs/quality/**`

Evite editar implementação só para “fazer o teste passar”. Se houver bug, reporte com reprodução e faça patch apenas quando pequeno e inequívoco.

## Missão

Dar confiança para integrar seis agentes sem cobertura artificial.

Teste comportamento do GeoNexo, não internals de bibliotecas maduras.

## P0 do projeto

Fluxo:

`criar projeto -> criar camada -> abrir mapa -> desenhar polígono -> salvar -> recarregar -> feature continua -> editar -> salvar`

Esse fluxo deve virar o principal E2E quando as peças estiverem integradas.

## Pirâmide

Prioridade:

- unit: lógica própria;
- integration: contratos/API/PostGIS/adapters;
- E2E: poucos fluxos críticos.

Não teste:
- implementação interna do Turf;
- internals do MapLibre;
- internals do Drizzle.

## Banco de teste

GIS espacial deve testar com PostGIS real.

Nunca rode teste destrutivo em branch Neon compartilhada ou produção.

Use:
- PostGIS container local, ou
- branch Neon efêmera quando disponível.

## Contratos

Crie contract tests para garantir:

- Zod compartilhado;
- GeoJSON;
- error envelope;
- version;
- enums;
- paginação;
- compatibilidade frontend/backend.

## GIS

Teste o adapter próprio, não pixel-perfect.

E2E:
- map canvas existe;
- basemap real ou fallback;
- draw mode;
- criação local;
- save;
- persistência;
- reload.

Evite flakiness externa: provider real deve ter smoke separado.

## Performance

Primeiro **meça**, depois defina budgets.

Fixtures:

- tiny;
- small;
- medium;
- large.

Use os tamanhos definidos no PRD de qualidade.

## Acessibilidade

Automático + manual:

- axe quando viável;
- teclado;
- foco;
- dialogs;
- toolbar;
- alternative textual da feature selecionada;
- contraste;
- reduced motion.

## CI

Não ative pipeline pesado antes do scaffold estabilizar.

Quando ativado:
- install frozen;
- lint;
- typecheck;
- unit;
- integration;
- build;
- security scan;
- E2E crítico;
- artifacts de falha sem secrets.

## Critério de aceite

- testes detectam falhas reais;
- nenhuma suite flaky aceita;
- PostGIS real cobre persistência espacial;
- `409` de version conflict coberto;
- erro de save mantém dado do usuário;
- fluxo GIS principal coberto quando integrado;
- comandos de validação documentados;
- falha E2E gera evidência útil.

## Validação

Antes de declarar pronto:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Quando existir:

```bash
pnpm test:e2e
```
