# MM-BRAND-20261019 — identidade MarkMap

**Status: SPECIFICATION GATE — DONE.** Esta especificação cobre somente a
identidade visível e os ícones do app MarkMap no worktree de release
`5e736e1fa7959798e5913d0fc1cb0af81baf21ef`. O arquivo de referência autorizado
é `D:\MATEUS\Dowloads\NOVO ICONE MARKMAP.jpg`.

## Objetivo e limites

Aplicar o ícone de referência aos assets de instalação e favicon do app,
substituir a marca visível GeoNexo por MarkMap e remover a palavra PWA das
mensagens apresentadas ao usuário. Preservar layout, comportamento, contraste,
rotas, URLs, domínios, dados locais e compatibilidade de importação.

O nome interno de pacotes e imports `@geonexo/*`, nomes de bancos IndexedDB,
chaves de storage, IDs do manifest, `start_url`, `scope`, Service Worker,
manifest versionado, endpoints e IDs de catálogo permanecem inalterados.
Comentários, testes e nomes internos podem continuar usando GeoNexo quando não
forem texto renderizado ao usuário. A vitrine `apps/site` continua separada e
não recebe manifest, ícone instalável ou proxy do app.

## Grafo de tarefas e propriedade

1. **Root — ícone/manifest/html**: transformar a imagem de referência, cujo
   conteúdo aprovado tem fingerprint `652C2C29AEBC...`, em aliases binários
   estáveis e em URLs versionadas, por exemplo
   `/icons/icon-192x192-652c2c29.png`, para que browsers detectem o novo
   conteúdo. Atualizar manifest, atalhos, favicon e Apple touch icon para as
   URLs versionadas, mantendo os caminhos antigos como aliases compatíveis.
   Confirmar configuração nativa existente antes de tocar qualquer wrapper;
   não inventar diretório Android/iOS.
   O escopo também inclui `MarkMapBrand.tsx` (imagem fonte preservando classes
   e dimensões atuais), `PwaInstallPrompt.tsx` (somente URL do ícone) e, se
   existir no projeto, o binário de `iOSAppIcon.appiconset/AppIcon-512@2x.png`.
   Não alterar App ID ou projeto nativo.
2. **Builder de texto visível — somente UI renderizada**: revisar títulos,
   cabeçalhos, créditos de tela e mensagens exibidas ao usuário que dizem
   GeoNexo ou PWA, substituindo por MarkMap e termos claros como aplicativo,
   instalação ou atualização. Preservar o crédito obrigatório
   `Desenvolvido por MtsFerreira · vMAJOR.MINOR.PATCH`.
3. **Builder de exportação**: alterar o nome visível do arquivo CSV de
   `geonexo-camadas.csv` para `markmap-camadas.csv`, mantendo colunas, conteúdo,
   escaping e proteção contra fórmulas.
4. **QA independente**: executar testes de manifest/favicon/shell, contraste,
   suíte admin aplicável, typecheck, lint e build; verificar que strings
   internas `@geonexo/*`, banco, SW e rotas não foram renomeadas.
5. **Root — validação nativa**: no PWA instalado, confirmar ícone/atalho após
   atualização, marca visível, export CSV com o novo nome, reload e preservação
   dos dados. Cache de ícone pode exigir atualização/reinstalação manual; isso
   deve ser registrado sem limpar dados locais automaticamente.

## Contratos de aceitação

- O arquivo de referência é usado como fonte do desenho; não criar uma marca
  aproximada por CSS ou SVG inventado.
- `manifest.json` mantém `id: "/"`, `start_url: "/"`, `scope: "/"`,
  `display: "standalone"` e versão interna. Referências de ícones, atalhos,
  favicon e Apple touch icon devem apontar para PNGs versionados com o novo
  conteúdo; os aliases nos caminhos antigos permanecem disponíveis para
  instalações/caches anteriores. `favicon.ico` só entra se o tooling existente
  já o produzir; não adicionar dependência para isso.
- O shell manifestado, Service Worker, cache versionado, IndexedDB/outbox,
  dados de mapas e todos os contratos offline continuam funcionando.
- A mudança de texto é limitada ao que o usuário lê na interface. Não fazer
  renomeação em massa de namespaces, contratos, tabelas, storage keys, schemas,
  URLs, API ou banco.
- CSV exportado contém o nome `markmap-camadas.csv`, preserva o conteúdo e
  continua baixável no Chrome nativo.
- Testes de instalação e atualização devem verificar ícone e marca sem
  confundir `appinstalled` com aceitação do prompt; o fluxo nativo existente
  permanece responsável pela instalação.

## Riscos e bloqueios

Ícones instalados podem permanecer em cache; a aceitação deve distinguir asset
novo servido pelo app de cache antigo do atalho do sistema. Não remover
IndexedDB, não alterar identidade PWA e não forçar atualização destrutiva.
Caso o arquivo de referência não possa ser convertido com os recursos já
instalados, parar antes de trocar assets e reportar o bloqueio. Caso texto
GeoNexo seja necessário para contrato interno, manter o texto interno e
alterar somente a ocorrência comprovadamente renderizada.

O gate de implementação começa somente após esta especificação. O gate de
release exige revisão independente, evidência dos testes e validação nativa de
ícone, marca, CSV, reload e dados existentes; não declarar concluído por
inspeção estática ou build isolado.

## Revisão e validação da implementação

- Fonte da imagem: SHA-256 `652C2C29AEBCFEB0D9DA4C90B46AC79BC2970EBA4798E157783014664D03F930`; conversão integral para PNG RGB opaco, sem recorte ou recriação. Área segura maskable: raio 0,398818 da largura, abaixo do limite 0,4.
- Revisão independente: aprovada sem findings; identidade da instalação e identificadores de persistência/protocolo preservados. Aliases antigos dos ícones continuam disponíveis.
- QA desta alteração: 46 arquivos/182 testes admin aprovados; TypeScript, ESLint e build aprovados; 11 testes de temas/fronteiras e um teste do gerador de shell aprovados. Dois warnings de hooks preexistentes permanecem.
- Dependências locais foram restauradas com pnpm 9.15.9 e lockfile congelado, sem alteração de versões ou lockfile, após detectar materialização incompleta de node_modules.
- O arquivo iOS existente foi atualizado; isso prepara o asset de fonte, sem alegar build/publicação de aplicativo nativo em loja.
- Publicação e confirmação na instalação Windows serão registradas no relatório externo de QA `branding/brand-final-report.md`, com o SHA do deployment e as evidências de ícone, CSV, mensagens e retenção dos dados. Não apagar dados nem reinstalar para trocar o ícone.

## Emenda vigente — marca transparente sem checkerboard

A fonte visual vigente passa a ser exclusivamente
`D:\MATEUS\Dowloads\NOVO ICONE MARKMAP SEM FUNDO.jpg`, um JPEG RGB 2048px com
checkerboard incorporado e sem alpha. Fingerprint da fonte:
`F5FE719CC0E69D97DB1FA36FEC39487AB330747321E017CA2DA4F411228B1D03`.

Antes de novos assets, o Root deve gerar uma cópia com alpha real usando a
ferramenta aprovada de remoção de fundo, preservando geometria, cores e
contorno. Inspecionar cantos, furos e área colorida: transparência somente no
fundo, sem apagar partes da marca. O hash da saída define as novas URLs
versionadas; não publicar o JPEG com checkerboard como ícone final.

Assets web normais, favicon e `MarkMapBrand` usam a versão transparente. Ícone
maskable e conjuntos nativos iOS usam composição opaca somente onde a
plataforma exigir, com fundo escuro `#07131f`, nunca branco, preservando safe
zone e legibilidade. O app não ganha novo App ID nem projeto nativo.

Os testes devem substituir a expectativa RGB opaca por RGBA com alpha
verificável nos assets web, mantendo dimensões e assinatura PNG; validar safe
zone maskable, ícones iOS opacos e referências versionadas. CSV, textos sem PWA,
identidade do manifest, storage, aliases antigos e importações permanecem
inalterados. Este gate de especificação continua DONE, mas novos edits de
produto aguardam a inspeção dos PNGs transparentes gerados.

### Fonte transparente final

O usuário substituiu a imagem branca pela referência `NOVO ICONE MARKMAP SEM FUNDO.jpg`. Como o JPEG contém o quadriculado incorporado, a remoção de fundo foi executada com image_gen e inspecionada sobre fundos claro/escuro nos tamanhos de uso. Master PNG RGBA: SHA-256 `CF74C7B01B3BBD797B780F97CBA0A25F3FDDEE09315EB29DFCCCC7DBEDBB3BC5`, preservado em `apps/admin/branding/markmap-logo-transparent.png` para permitir futuras derivações sem depender do JPEG. Não usar os candidatos intermediários rejeitados.

Ícones regulares, favicon e marca na interface usam alpha real. Maskable e o asset iOS recebem somente o fundo opaco compatível `#07131f`; não há fundo branco. Maskable mantém margem de 4% adicional para proteger o recorte do sistema. Os novos URLs usam `cf74c7b0`; aliases sem fingerprint continuam disponíveis e os arquivos versionados anteriores permanecem para compatibilidade. CSV e remoção dos termos visíveis permanecem iguais ao commit já validado `2f396ede65f8032aec53e76c75d4f650b2b32a97`.
