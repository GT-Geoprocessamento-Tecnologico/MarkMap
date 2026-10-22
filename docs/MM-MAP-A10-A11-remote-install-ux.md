# MarkMap — A10/A11: retomada na UI, cancelamento e quota

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**HEAD auditado:** `b753278e104ff2d7319d83c5cae6790c3816d132`  
**Estado:** implementação e regressão Node local; navegador/dispositivo não homologados.

## Objetivo e contexto

Permitir que o responsável por um mapa regional veja o progresso já salvo antes de baixar, retome de modo explícito, cancele desde a primeira requisição do manifest, entenda limites de armazenamento e confirme a troca de versão sem eliminação automática de dados. Offline-first: IndexedDB/outbox e o mapa ativo permanecem a fonte operacional. Nenhuma dependência de Neon para uso em campo.

## Auditoria inicial do HEAD

- **FUNCIONA EM CÓDIGO:** A8/A9 mantém blocos de download em IndexedDB v1, checksums e geração ativa; retoma arquivos sem recriar os chunks já válidos.
- **PARCIAL:** `checkResume(packageId)` contava checkpoints mas a UI não expunha essa informação. O instalador só criava `AbortController` após consultas de quota e preparação.
- **QUEBRADO / PROBLEMA IDENTIFICADO EM LEITURA (não reproduzido):** o botão Cancelar aparecia antes da leitura do manifest, mas `activeRegionalInstaller` ainda era `null`. Portanto cancelar durante a consulta inicial não interrompia essa chamada.
- **NÃO IMPLEMENTADO:** confirmação de versão na tela, diagnóstico específico de quota e indicador de fases de validação/ativação.

## Escopo A10 — interface de retomada

1. `SettingsPage` oferece **Verificar progresso salvo** antes de instalar; consulta apenas manifest e checkpoint, sem escrever nem apagar dados.
2. Mostra região, tamanho, blocos completos contabilizados, percentual e estágio `checking/downloading/validating/activating/canceling` com progressbar nativo.
3. `fetchRemoteRegionManifest()` aceita `AbortSignal` opcional e cancela antes ou durante a leitura; o signal continua até o instalador, que o verifica nas transições pré-download, durante o stream e antes da ativação.
4. Botão **Cancelar operação** só é oferecido antes da ativação; componentes desmontados abortam a operação para não deixar instalação silenciosa em segundo plano. Chunks completos persistidos não são apagados por cancelamento.
5. `checkResume(packageId, manifest?)` compara versão/hash de todos os recursos ao checkpoint salvo. Versão divergente exige **Confirmar nova versão e baixar**; o usuário autoriza explícita troca de staging, sem tocar o mapa ativo. Sessões legadas sem tamanhos seguem sem mensagem falsa de progresso validado.

## Escopo A11 — resiliência e quota

1. Mapeia códigos de download para mensagens específicas: cancelado, sem espaço temporário, orçamento agregado, rede, conflito com outra aba, checksum, versão antiga e armazenamento indisponível.
2. Converte `QuotaExceededError` originado no fluxo local de instalação para erro recuperável de espaço insuficiente; preserva checkpoints, projetos, outbox e mapa ativo sem limpeza automática.
3. Mostra orientação para revisar armazenamento via painel existente; nunca assume espaço disponível ou promete instalação de 250 MiB em qualquer aparelho.
4. Se a consulta falha/cancela, o usuário pode repetir com a mesma URL. O histórico de fonte confiável só é atualizado depois de instalação com sucesso, como antes.

## Fora do escopo

Sem limpar dados, resetar IndexedDB, deletar checkpoints automaticamente, instalar biblioteca nova, alterar contratos/versão do DB, mudar PWA SW, publicar extratos OSM, mudar servidor Hono/Neon, criar catálogo remoto, permitir fonte HTTP pública, deploy/release ou merge em `main`.

## Arquivos afetados

- `apps/admin/src/pages/settings/SettingsPage.tsx` — fluxo UX com estados de operação, consulta read-only, cancelamento, indicação de quota e confirmação de nova versão.
- `apps/admin/src/lib/storage/resumable-installer.ts` — `AbortSignal` opcional, assinatura compartilhada de versão, verificação de cancelamento e sinalização de ativação/quota.
- `apps/admin/src/lib/storage/remote-region-manifest.mjs` e `.d.mts` — suporte opcional a AbortSignal.
- `apps/admin/src/lib/storage/region-install-feedback.mjs` e `.d.mts` — mensagens seguras e identificação de quota.
- `apps/admin/src/lib/storage/region-install-feedback.test.mjs` — regressões Node sem rede.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` — atualização do estado operacional.

## Segurança, regras e critérios de aceite

- Na checagem de progresso, **somente leitura**: nunca abrir/gravar sessão ou descartar checksum.
- Só afirmar retomada quando `manifestSignature` coincidir, inclusive hashes de conteúdo opcional, e contador de chunks for confiável.
- ID do pacote validado pelo schema existente, URLs somente HTTPS/localhost sem credenciais/query e limite do manifest de 64 KiB intacto.
- Cancelar consulta inicial impede leitura/instalação; cancelar antes da ativação solicita abort, retorna estado apropriado e mantém dados salvos; após ativação iniciada, a UI não oferece cancelamento enganoso.
- Troca de versão depende de clique explícito; qualquer limpeza usa `finishSession()` transacional existente, que mantém chunks compartilhados por outra região.
- Quota insuficiente retorna orientação em vez de descartar mapas/projetos. Checksum errado nunca ativa pacote.
- Nenhum call para Neon ou API remota de usuário, nenhum segredo novo no cliente.

## Testes / QA / evidências

**Executados no ambiente local Linux, Node v22.16.0:** `node --test` para os 3 testes históricos do manifesto e os 5 novos de feedback/AbortSignal: **8/8 PASS**, 0 falhas; `node --check` dos `.mjs` alterados e análise sintática de `SettingsPage.tsx` / `resumable-installer.ts` com `typescript.transpileModule`: **0 erros de sintaxe**.

**NÃO EXECUTADO e não impeditivo às próximas fases de desenvolvimento:** lint/typecheck/build completo do monorepo (dependências/checkout integral indisponíveis), React Testing Library, Playwright, IndexedDB em browser, browser real/WebView, Android/iOS físicos, 250 MiB reais e medição de RAM. Não confundir os 8 testes isolados com a aprovação de M10 ou com uma suíte de 53/53 reexecutada nesta rodada.

## Riscos, Git, rollback e relatório

- A contagem de blocos válidos comprova somente tamanhos/offsets; SHA de todo arquivo é revalidado antes da ativação. Um checkpoint pode ser corrompido após a contagem e será rejeitado no download.
- Um abort durante ativação transacional já iniciada não é rollback garantido; por isso não expor botão Cancelar nesse estado.
- Trabalhar só na branch `dev/markmap-pwa-v2`, confirmar HEAD antes de atualizar, `[skip ci]`, não sobrescrever commits de outros agentes.
- **Proibido sem autorização:** GitHub CI, deploy público Vercel, merge main, release/tag, migrations ou exclusões em produção, force push, segredos e deleção de branches/dados de campo.
- **Rollback:** revert isolado do commit A10/A11 na branch dev. Nenhuma migração para reverter. Atualizar Notion + checklist mestre + handoff.
- **Relatório final esperado:** HEAD/commit, arquivos e evidências reais, testes não executados, impacto offline/armazenamento, riscos residuais e próximo incremento disponível.
