# MM-PWA-A63 — confirmação nativa de instalação e abertura standalone

Data: 2026-10-13. Baseline: main@45496ed16676916e8aabac96f62dbb05636dea8f; Checklist Mestre do Notion consultado, sem PR ativo.

## Objetivo
Quando o usuário acionar **Instalar aplicativo** na PWA, o navegador deve mostrar o prompt nativo de autorização quando `beforeinstallprompt` estiver disponível; aceito o pedido, não iniciar o workspace no navegador e indicar como iniciar o aplicativo instalado pelo ícone. A vitrine continua apontando para a origem `https://appmarkmap.mtsferreira.dev/?install=1`; nesse caminho o conteúdo operacional fica oculto durante a instalação.

## Diagnóstico / situação
FUNCIONA: manifest do app em `/`, scope `/`, `standalone`, service worker e IndexedDB locais, interceptação do `beforeinstallprompt`. PARCIAL: a vitrine abre a interface Web na origem do app antes do prompt nativo; o modo guiado renderiza apenas aviso; após aceite o workspace continua em navegador. FALHA POTENCIAL: `appinstalled` emitido antes do fim de `userChoice` pode ser revertido pelo estado capturado com `detectStandalone()`. NÃO IMPLEMENTADO: tela de instalação exclusiva com conclusão pós-instalação.

## Escopo e arquivos
`apps/admin/src/lib/pwa-install.ts`, `apps/admin/src/App.tsx`, `apps/admin/src/components/pwa/PwaInstallPrompt.tsx`, `apps/admin/src/styles/main.css`, testes PWA de instalação e renderização, Notion/handoff. Preservar CTAs do site, manifest, worker, rotas do app, frontend escolhido e stack atual.

## Segurança, integridade e proibições
`BeforeInstallPromptEvent.prompt()` deve ser chamado **sincronamente no clique**, sem `await` prévio; uma chamada por evento. Não simular consentimento, não marcar instalado até `appinstalled`/standalone. `accepted` só confirma escolha, não é prova de instalação concluída. Sem redirecionamento forçado, `window.close()`, URL scheme não verificado, cache privado, limpeza de IndexedDB, deploy manual, migration, release, force push ou publicação. Safari/iOS e navegadores sem evento precisam de instruções manuais acessíveis; nunca afirmar janela nativa onde não há suporte.

## Critérios de aceite
1. Acesso normal ao app mantém interface atual. Acesso com `?install=1` no navegador abre tela exclusiva com CTA instalar e oculta workspace/sync até escolha do usuário.
2. Clique quando `available=true` chama prompt nativo e respeita aceite/cancelamento/erro. Disponibilidade só após evento recebido.
3. `appinstalled` é sinal de instalação; `userChoice=accepted` mantém estado de solicitação aprovada sem fingir que iniciou app standalone.
4. Após aceite, tela apenas indica **Abrir pelo ícone MarkMap**. `start_url=/` segue abrindo app completo em standalone.
5. Safari/iOS ou navegador sem suporte mostra orientação para menu de instalação, sem travar a tela nem alegar sucesso.
6. Testes para intenção guiada, interface normal, evento, corrida ACK de instalação, cancelamento/erros e contrato do manifest; build e typecheck do HEAD.

## QA, riscos, rollback, relatório
Executar validação automatizada disponível; homologação em navegador instalado e aparelhos continua pendente e não pode ser assumida. Risco: navegador não disponibilizar o evento por elegibilidade, permissões ou instalação prévia. Rollback via `git revert` do(s) commits A63, sem alteração de dados. Relatório breve com SHA, PASS comprovados e impedimentos. Alterar somente main solicitada anteriormente, conferir blobs/HEAD antes dos commits.