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

# Função: Frontend Admin

## Branch

`agent/frontend`

## PRD específico

`instruções/21-FRONTEND-VISIONARIO-PRD.md`

## Pré-condição

Comece após merge da foundation.

## Ownership exclusivo

- `apps/admin/**`
- `packages/ui/**`
- `frontend/**`

### Read-only

- `packages/maps/**` — GIS é owner
- `packages/geo/**` — GIS é owner
- `packages/db/**` — Database é owner
- `services/api/**` — Backend é owner
- `packages/contracts/**` — Backend é owner após foundation

## Missão

Construir o painel admin web com aparência profissional e fluxo claro, consumindo contratos e adapters existentes, sem recriar lógica GIS ou API no frontend.

## Primeiro fluxo de produto

Implemente a experiência necessária para:

1. visualizar projetos;
2. criar projeto;
3. abrir workspace de projeto;
4. listar/criar camadas;
5. renderizar área de mapa através de `packages/maps`;
6. selecionar/desenhar feature quando o adapter GIS estiver disponível;
7. editar propriedades;
8. salvar via API;
9. mostrar loading/error/empty/success;
10. recarregar e continuar consistente.

## UI

- use `packages/ui`;
- shadcn/Radix como primitives, não como identidade final;
- tokens próprios;
- layout denso, profissional e legível;
- toolbar clara;
- painéis não devem esmagar o mapa;
- responsividade desktop/tablet/mobile sem criar “app mobile” separado;
- reduced motion;
- foco visível;
- navegação por teclado onde aplicável.

## Estado

- TanStack Query para server state;
- estado local React primeiro;
- Zustand somente quando houver estado compartilhado real;
- não guardar cópia desnecessária do mesmo dado em três lugares;
- mutation com double-submit bloqueado;
- save falhou -> manter estado dirty e permitir retry;
- conflito `409` -> nunca sobrescrever silenciosamente.

## API

Consuma `packages/contracts`; não replique interfaces.

Se o endpoint ainda não existir:
- implemente adapter/mock mínimo claramente isolado somente se o PRD permitir;
- não hardcode contrato alternativo;
- registre dependência no handoff.

## GIS

Você **não implementa** MapLibre/Terra Draw diretamente nesta branch.

Consuma a API pública de `packages/maps`.
Se faltar função:
- registre a necessidade;
- evite colocar lógica GIS dentro da página.

## Design

Siga o PRD visual. Reutilize componentes, não crie mega-componentes.

Componentes de página devem orquestrar; cálculos e map engine ficam nos packages corretos.

## Critério de aceite

- admin abre localmente sem login;
- navegação principal funciona;
- project/layer flows têm todos os estados;
- workspace reserva mapa como elemento central;
- integração com contracts é tipada;
- não existe `any`;
- não existe `console.log` de produção;
- não há acesso a DB direto;
- footer/documentação visual seguem o PRD aplicável.

## Validação

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Quando o fluxo integrado estiver disponível, rode os testes E2E relevantes sem alterar suite pertencente ao agente Quality.
