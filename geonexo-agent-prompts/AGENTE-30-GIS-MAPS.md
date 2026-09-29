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

# Função: GIS / Maps

## Branch

`agent/gis`

## PRDs base

Não existe um PRD exclusivo de GIS no pacote atual. Sua fonte de verdade é:

- `instruções/00-MASTER-PRD.md` — seções de GIS, mapas e reuso;
- `instruções/50-CONTRATOS-DE-INTEGRACAO.md`;
- `instruções/21-FRONTEND-VISIONARIO-PRD.md` somente para necessidades de interface;
- `instruções/40-QUALIDADE-VISIONARIO-PRD.md` para casos GIS que precisam ser testáveis.

## Pré-condição

Comece após merge da foundation.

## Ownership exclusivo

- `packages/maps/**`
- `packages/geo/**`
- `docs/gis/**`
- fixtures GIS específicas dentro de paths exclusivos

### Read-only

- `apps/admin/**`
- `services/api/**`
- `packages/db/**`
- `packages/contracts/**`

## Missão

Construir o núcleo GIS reutilizável para que o admin **consuma mapa sem conhecer detalhes do provider ou do motor de desenho**.

## Tecnologias aprovadas

Priorize:

- MapLibre GL JS;
- Terra Draw;
- Turf.js;
- Proj4js;
- PMTiles quando necessário;
- GeoTIFF.js quando necessário;
- GeoPackage.js quando necessário;
- `geojson-vt` / `supercluster` apenas se o caso real exigir;
- OpenFreeMap como basemap inicial via provider adapter.

Não introduza Google Maps/Mapbox como dependência central.

## API pública esperada de `packages/maps`

Mantenha simples. O package deve expor primitives/adapter suficientes para:

- criar/destruir map instance;
- registrar/trocar basemap provider;
- adicionar/remover source/layer;
- controlar visibility;
- fit bounds;
- selecionar feature;
- ativar modos draw point/line/polygon;
- receber eventos de create/update/delete;
- converter eventos do draw para o contrato GeoJSON do GeoNexo;
- mostrar fallback quando basemap externo falhar.

Não exponha internals do Terra Draw para as páginas.

## `packages/geo`

Centralize:

- CRS constants;
- SIRGAS 2000 / EPSG:4674;
- transformações via Proj4;
- validação leve de coordenadas;
- bbox;
- área/distância;
- helpers GeoJSON realmente reutilizados.

Não implemente algoritmo geoespacial já resolvido por Turf/Proj4.

## Provider

OpenFreeMap deve entrar por registry/config, nunca hardcoded em página.

A API do package deve permitir futura troca por:

- self-host;
- PMTiles;
- Martin/vector tiles;
- fonte institucional.

## Performance futura

Não force GeoJSON gigante no browser.

Deixe caminho claro:

- pequeno/médio: GeoJSON;
- grande: tiles/PMTiles/Martin.

Evite otimização prematura, mas não feche a arquitetura.

## Critério de aceite

- mapa MapLibre renderiza com provider configurável;
- falha de basemap tem fallback;
- ponto/linha/polígono podem ser desenhados via adapter;
- create/update/delete emitem GeoJSON estável;
- visibility de layer funciona;
- seleção funciona;
- helpers de área/distância/CRS estão centralizados;
- nenhum componente de admin é necessário para testar o package;
- APIs públicas têm tipos explícitos e documentação curta.

## Validação

- testes unitários apenas do nosso adapter/helpers;
- não teste internals de MapLibre/Turf;
- rode:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Registre no handoff qualquer contrato que precise ser adicionado por Backend.
