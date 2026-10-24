# A4 — Publicação transacional de regiões e memória de importação

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**HEAD-base verificado:** `014aeff71e3e736e7224a67ac7d44ee297b60d46`  
**Estado:** parcial em código; validações executáveis reservadas ao gate M10.

## Objetivo
Evitar a exposição de pacotes regionais parcialmente gravados e reduzir cópia desnecessária de `Blob` durante a instalação offline. Preservar artefatos, projetos, IndexedDB e outbox sem mudanças destrutivas.

## Contexto e auditoria
- **FUNCIONA EM CÓDIGO / não revalidado:** gerador regional de PMTiles, manifest com checksums, instalação por pasta/HTTPS, staging/ativação IndexedDB, seleção de mapa e outbox local.
- **PARCIAL:** publicação dos pacotes já verificava os arquivos individualmente, mas escrevia cada artefato diretamente no diretório final antes da última validação; `OfflineMapStore.stage` materializava `Blob` de arquivo em um segundo `ArrayBuffer`.
- **RISCO CONCRETO (não reproduzido):** erro tardio na criação de grafo/DEM/licença/dependência de estilo pode deixar arquivos de um pacote incompleto junto de um `manifest.json` antigo. A pasta de saída pode ser reutilizada por outro agente.
- **NÃO IMPLEMENTADO:** checksum incremental no browser para pacote grande, instalação móvel E2E acima de 64 MiB e distribuição de mapas com fontes reais licenciadas.

## Escopo
1. Empacotar todos os artefatos do pipeline em pasta temporária exclusiva (mesmo diretório pai do destino, nome aleatório).
2. Antes da publicação, verificar caminhos únicos e seguros, tamanho e SHA-256 de cada arquivo no staging via stream (sem carregar PMTiles grande novamente na RAM).
3. Somente após manifest e todos os artefatos íntegros, renomear a pasta inteira para o destino. Destino com arquivos existentes deve ser preservado e produzir erro `OUTPUT_NOT_EMPTY`. Destino inicialmente vazio é suportado para compatibilidade com os testes históricos.
4. Na falha, remover somente a pasta temporária criada pela operação; preservar quaisquer arquivos anteriores. Se um diretório vazio do usuário precisou ser removido para renomear e houver erro, recriá-lo.
5. No armazenamento do app, manter `Blob` já imutável como referência em vez de converter para `ArrayBuffer` e criar segunda cópia apenas para armazená-lo no IndexedDB. Continua usando validação existente de SHA-256 e contrato v2.

## Fora do escopo
- Não baixar dados cartográficos, não obter licença automaticamente, não aumentar limite de PBF integrado (32 MiB) nem instalador remoto (64 MiB).
- Não alterar contratos, versão de banco/IndexedDB, Neon, API Hono, PWA SW, Workbox, MapLibre ou stack.
- Não publicar em Vercel, produzir APK/iOS, executar migração ou alterar dados de produção.
- Não sobrescrever diretórios de saída contendo qualquer conteúdo; atualização de pacote deve usar novo caminho de publicação.

## Arquivos afetados
- `scripts/region-pipeline.mjs`: construir em staging, verificar hashes e promover pasta inteira.
- `apps/admin/src/lib/storage/offline-map-store.ts`: evitar duplicação de buffer para fontes `Blob`.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md`: sincronização de estado.
- Este PRD/handoff.

## Segurança, integridade e regras Git
- Nunca excluir arquivos fora do diretório temporário criado pela operação; não apagar `main`, branches legadas, dados locais de campo, caches do usuário nem outbox.
- Não aceitar symlink para diretório final e nunca seguir traversal nos caminhos gerados.
- `OUTPUT_NOT_EMPTY` é deliberado: evita overwrite de saída criada por outro agente; processo não substitui mapa em uso.
- Trabalhar apenas em `dev/markmap-pwa-v2`, fazer atualização fast-forward condicionada ao SHA atual e preservar `main`. Commits `[skip ci]`, nenhum force-push.

## Critérios de aceite (para M10)
- **Dado** diretório de saída inexistente ou vazio e pacote íntegro, **quando** rodar o pipeline, **então** a pasta final é publicada com `manifest.json`, arquivos e checksums válidos.
- **Dado** erro tardio (grafo/DEM/estilo inválido), **quando** falhar, **então** a saída anterior permanece idêntica e nenhum manifest incompleto é publicado.
- **Dado** destino com arquivo existente, **quando** tentar publicar, **então** falhar `OUTPUT_NOT_EMPTY`, sem modificar conteúdo.
- **Dado** PMTiles maior que 32 MiB pré-gerado, **quando** publicar, **então** hash é calculado por streaming no publicador sem `readFile` do arquivo inteiro.
- **Dado** `Blob` existente e contrato válido, **quando** instalar no IndexedDB, **então** stage usa o objeto Blob já materializado; nenhuma eliminação de verificação SHA nem mudança de ativação.

## Testes e QA
**NÃO EXECUTADOS nesta etapa conforme regra de projeto de reservar QA integral ao M10**: Node testes de pipeline e corrupção, lint/typecheck, Vitest, build, Playwright, navegador IndexedDB, testagem de dispositivos e fontes reais.
No M10 executar `node --test scripts/*.test.mjs` ou seleção compatível com o repo, `pnpm lint`, `pnpm typecheck`, `pnpm build`, Playwright e verificação de pacote real licenciado. Registrar saída real dos comandos; não marcar concluído antes.

## Riscos e rollback
- Renomear diretórios é atômico somente dentro do mesmo filesystem; snapshot e bloqueios de diretórios são dependentes do SO. Reinício abrupto pode deixar `.staging-*` órfão, mas sem promover parcialmente.
- `Blob` reduz cópia no estágio, porém a verificação SHA WebCrypto ainda materializa dados em memória: **não comprova importação móvel de 250 MiB**.
- RunPipeline agora recusa saída não vazia; chamadas que reciclavam a pasta precisam usar destino novo. Não limpar diretórios automaticamente.
- Reversão: revert isolado de commit A4 na branch dev, sem tocar banco, arquivos de campo ou `main`.

## Relatório final esperado
Indicar HEAD/commit, arquivos alterados, limites intactos, ambiente/comandos/saídas, cenários de falha/rollback, testes não realizados, fontes e licenças reais verificadas (quando disponíveis) e pendências `MM-MAP-900/940`.
