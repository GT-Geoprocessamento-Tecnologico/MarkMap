# MarkMap — A20/A21: recuperação de erros cartográficos e fundo simples offline

**Data:** 2026-10-10  
**HEAD-base auditado:** `dev/markmap-pwa-v2@55bd506a70d09f750f45930a8b64583b528182da`  
**Objetivo:** tornar a falha do mapa recuperável sem remover pacotes, projetos, desenhos ou dados offline.

## Auditoria e contexto

- **FUNCIONA em código:** A18/A19 verificam geração da região no IndexedDB ao voltar do segundo plano e limitam leituras ao identificador de geração ativo; a aplicação já possui `createFallbackStyle()` totalmente local, com background e sem fontes remotas.
- **PARCIAL:** `CommandCenterPage` mostra `mapError` quando o pacote/cartografia local falha, mas não permite reconstruir MapLibre sem mudar a região/rota. Se `initialize()` lança exceção antes de montar o mapa, só resta a mensagem de erro.
- **PARCIAL:** o fallback existente trata falhas do basemap remoto, mas um pacote regional offline que falha não oferece o mesmo modo de exibir as feições locais.
- **NÃO COMPROVADO:** recuperação efetiva em Android/iOS físico, WebGL context loss real, quota/memória e renderização MapLibre E2E.

## A20 — recuperação sem tentativas infinitas

1. Expor botão acessível **Tentar novamente** apenas quando o erro pertence à cartografia; ele incrementa uma revisão de renderização para executar o cleanup MapLibre atual e recriar os protocolos/mapa pelos fluxos existentes.
2. Nos eventos de foreground já utilizados em A18, se houver erro e o contexto for GeoPDF ou mapa regional local, permitir **uma única tentativa automática** por contexto/geração. Nunca fazer polling, temporizadores de retry ou loop de requisições; qualquer tentativa posterior depende do botão.
3. Ignorar erros emitidos após cleanup de um mapa cancelado e limitar alertas em rajada ao primeiro erro útil, sem renderizar uma notificação por tile.
4. Limpar o erro visual ao recomeçar. Não mexer em IndexedDB, localStorage, sync/outbox, nem baixar ou reinstalar o pacote como forma de recuperação.

## A21 — modo de fundo neutro, sem rede

1. Quando um pacote regional selecionado falhar, oferecer botão **Usar fundo simples offline**.
2. Usar o `createFallbackStyle()` existente em data URI, sem tiles, sprites, glyphs ou serviços remotos, mantendo os overlays de GeoJSON/dados de campo do `CommandCenterPage`.
3. Preservar a seleção armazenada e o pacote em IndexedDB: o modo neutro é estado **somente da tela**, associado ao ID e revisão da região, não um uninstall nem troca persistente de mapa.
4. Mostrar aviso e ação **Voltar ao mapa regional**. Se a região for atualizada entre abas enquanto o modo neutro estiver ativo, permitir reabrir a nova geração. GeoPDF continua tendo precedência sobre qualquer fallback regional.
5. Em problemas globais de WebGL a visualização neutra também pode falhar; não afirmar que corrige ausência de GPU/MapLibre.

## Fora do escopo

Sem novas libs de mapas, alteração no renderer, atualizações de IndexedDB schema, modificações de sync, Neon/PostGIS, migrações, download automático de mapas, troca de URL do manifest, exclusão de caches ou projetos, deploy, CI remoto, merge `main`, release/tag e publicação móvel. Não construir sistema paralelo de retry.

## Arquivos afetados

- `apps/admin/src/lib/map/offline-map-recovery.mjs`, `.d.mts` — política de retry em foreground e seleção de fundo neutro.
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — ciclo do mapa, estados e botões de recuperação.
- `scripts/offline-map-recovery.test.mjs` — testes direcionados de lógica/política.
- `docs/MM-MAP-A20-A21-map-recovery.md`, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md`.

## Segurança e critérios de aceite

- **Erro local / botão retry:** ao clicar, o mapa é desmontado e criado de novo a partir do armazenamento local; nenhum `clear()`, delete, migração ou alteração da seleção ocorre.
- **Foreground / falha:** após focus/pageshow/visible, no máximo uma tentativa automática por contexto enquanto o erro persistir; repetidos eventos não disparam loop.
- **Operação normal:** sem erro, foreground não reconstrói mapa; contexto não offline não força retry automático.
- **Modo neutro:** fundo simples local disponível por ação explícita, com os dados do projeto preservados e indicação visível do modo ativo. Botão de retorno restaura tentativa do pacote selecionado.
- **Troca de região ou revisão:** fallback da região anterior não vaza para outra; GeoPDF continua prioritário.
- **Erro após cleanup:** callback tardio de mapa desmontado não atualiza estado do mapa novo; erro em rajada é coalescido.

## Verificações realmente executadas

**Ambiente:** Node.js 22.16.0, Linux; recorte de regressão local herdado do SHA A18/A19.

- `node --test scripts/*.test.mjs` no recorte A10–A21: **42/42 PASS**, zero falhas e zero skips (36 regressões anteriores + 6 novos casos A20/A21).
- `node --check apps/admin/src/lib/map/offline-map-recovery.mjs`: **PASS**.
- `tsc --strict --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022 apps/admin/src/lib/map/offline-map-recovery.d.mts`: **PASS**.
- Conferência estática dos anchors/diff do componente de UI antes do commit.

**NÃO EXECUTADOS:** build/lint/typecheck integral do monorepo, navegador MapLibre real, Playwright, IndexedDB/WebView, cenário físico WebGL/Android/iOS e medição de performance. Isso não bloqueia novas fases de desenvolvimento, mas não deve ser declarado como homologação.

## Riscos, rollback, Git e relatório final

- O fundo neutro exige MapLibre/WebGL operacional; é alternativa para dados de basemap, não reparo de contexto gráfico destruído.
- O retry intencionalmente remove/recria o mapa da tela; estado transitório da visualização e marcadores temporários pode ser refeito pelos componentes existentes, sem excluir conteúdo persistido.
- Falhas repetidas ainda exigem intervenção do usuário depois da tentativa automática; evita loop de recurso corrompido.
- Somente `dev/markmap-pwa-v2` com HEAD verificado e commit `[skip ci]`, sem force push nem sobrescrever outro agente.
- **Ações proibidas sem autorização:** merge `main`, GitHub Actions remoto, deploy Vercel, Neon/migrations, tags/releases, assinatura/publicação em loja, secrets, dados/branches alheios, exclusões destrutivas.
- **Rollback:** revert isolado da A20/A21. Nenhum schema/contrato novo.
- **Relatório:** commit/arquivos, testes observados versus pendentes, risco residual, PRD/handoff e Checklist Mestre no Notion sincronizados.
