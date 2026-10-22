# Contrato permanente — site e aplicativo

**Proprietário:** MtsFerreira. Esta decisão não depende dos nomes dos domínios.

## Separação obrigatória

| Produto | Código | Endereço e finalidade |
|---|---|---|
| Site | `apps/site` | Subdomínio próprio. Somente vitrine, conteúdo público e link de instalação. |
| Aplicativo | `apps/admin` | Outro subdomínio próprio. Única origem da PWA, instalação, dados locais, mapa e sincronização. |
| Backend | `services/api` | API própria conforme configuração existente; nunca executada pelo site. |

O monorepo e os pacotes compartilhados continuam os mesmos, mas **cada frontend possui build e deploy próprios**. Nenhum deve copiar os assets, os cookies, o cache, o IndexedDB ou a identidade PWA do outro.

## Fluxo de instalação — não alterar sem autorização

1. O botão do site é um **link HTTPS**, definido somente em `apps/site/src/site-config.ts`, para a origem do **app** com `?install=1`. Não instalar a vitrine.
2. O app mostra a tela de instalação sem carregar workspace ou sincronização nessa aba. O clique do usuário chama o prompt nativo, quando o navegador oferece `beforeinstallprompt`.
3. `userChoice=accepted` não prova instalação concluída. `appinstalled` ou modo standalone determina o estado instalado. Safari/iOS segue orientação manual.
4. Ao abrir pelo **ícone instalado**, o manifest do app usa `id=/`, `start_url=/`, `scope=/` e `display=standalone`; a operação principal funciona offline.
5. O site **não** vincula manifest instalável, **não** registra Service Worker novo e **não** faz proxy de assets/HTML do aplicativo.
6. Apenas as rotas antigas `/app*` da vitrine podem redirecionar ao app para compatibilidade. O SW legado só encaminha essas rotas; nunca armazena dados operacionais.

## Padrão do código — Desenvolvido por MtsFerreira

- O crédito público é **Desenvolvido por MtsFerreira**, com link para o site do autor; no app, mostrar **· v[versão]** imediatamente depois.
- A versão exibida vem de `apps/admin/package.json`, mas mostra somente `vMAJOR.MINOR.PATCH`, sem sufixo de desenvolvimento ou build. A formatação não altera o valor do pacote; esse valor canônico deve ser incrementado a cada atualização publicada, conforme [versioning.md](versioning.md).
- Código enxuto: funções e componentes pequenos, nomes objetivos, TypeScript tipado, sem duplicações ou arquivos monolíticos novos.
- Comentar **porquê, decisões, riscos e contratos**; não explicar linhas óbvias, nem gerar comentários repetitivos. Manter cabeçalho de autoria nos módulos de identidade e distribuição e preservar a atribuição existente.
- Em código legado extenso, **refatorar gradualmente com testes**. Não reformatar ou comentar centenas de arquivos sem necessidade: isso pode esconder mudanças e sobrescrever outros agentes.

## Proteções e revisão

- Mudanças em domínio, manifest, service worker, `site-config`, redirecionamentos, botão instalar ou assinatura exigem revisão do contrato e testes.
- Executar `node --test scripts/pwa-product-boundaries.test.mjs`, testes do site/app, typecheck e builds aplicáveis.
- Verificar HEAD, Checklist Mestre no Notion e trabalho paralelo antes de alterar arquivos. Sem troca de stack, publicação, limpeza de dados locais ou migrations destrutivas automáticas.
- O nome/endereço exato dos subdomínios pertence à configuração e à infraestrutura, **não** a esta decisão arquitetural.
