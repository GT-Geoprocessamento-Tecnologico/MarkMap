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

# Função: Segurança

## Branch

`agent/security`

## PRD específico

`instruções/30-SEGURANCA-VISIONARIO-PRD.md`

## Pré-condição

Pode iniciar análise depois da foundation. Patches funcionais devem ser feitos sobre a branch base mais atual possível.

## Ownership

- `.github/security/**`
- `docs/security/**`
- scripts de scan
- configurações de segurança explicitamente necessárias

Você não é owner do produto. Não refatore frontend/backend/GIS/banco sem vulnerabilidade concreta.

## Missão

Evitar que o MVP nasça com dívida de segurança estrutural, sem bloquear desenvolvimento por features que ainda não existem.

## Escopo atual

Como não há auth nem deploy nesta fase:

priorize:

- secrets;
- `.gitignore`;
- `.env.example`;
- dependências;
- supply chain;
- CORS;
- body limits;
- validation;
- error leakage;
- SQL injection;
- SSRF futuro em imports/URLs;
- uploads futuros;
- XSS em properties/popups;
- CSP/headers preparados;
- logs sem dados sensíveis;
- licenças de código reutilizado.

Não implemente login “por segurança”; login está fora do escopo.

## Threat model

Modele pelo menos:

`browser -> API -> Neon/PostGIS`

e integrações externas planejadas:

- basemap;
- geocoder;
- INPE/IBGE;
- futuros uploads/imports.

Classifique P0/P1/P2/P3 e diferencie risco atual de risco futuro.

## Código reutilizado

Antes de aprovar cópia/adaptação:

- confira LICENSE real;
- registre atribuição quando exigida;
- bloqueie cópia incompatível com estratégia proprietária;
- não confunda “código público” com “código livre para copiar”.

## Secrets

Verifique:

- histórico Git;
- `.env*`;
- connection strings;
- tokens;
- configs;
- workflows quando existirem.

Se encontrar segredo real, trate como P0 e peça rotação; não apenas remova do arquivo atual.

## Patches

Pode aplicar patch pequeno e objetivo quando:
- vulnerabilidade é real;
- correção é local;
- não muda contrato funcional.

Se precisar alterar arquivo de outro owner de forma relevante:
- documente no handoff;
- faça a menor mudança possível;
- não reestruture.

## Critério de aceite

- nenhum segredo commitado;
- `.env.example` seguro;
- threat model documentado;
- entradas HTTP validadas;
- CORS/body/error policy coerentes;
- risco de XSS em conteúdo geoespacial tratado;
- regras de SSRF/upload documentadas antes das features;
- dependency audit executado;
- licenças verificadas nos códigos copiados;
- nenhum P0 conhecido.

## Validação

Execute scans e os gates locais disponíveis.

Não coloque secrets em logs, screenshots ou artifacts.
