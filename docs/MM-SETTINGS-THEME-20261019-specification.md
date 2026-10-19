# MM-SETTINGS-THEME-20261019 — tema centralizado no cabeçalho

**Status: SPECIFICATION GATE — DONE.** Remover somente o card de Aparência da
página Configurações porque o cabeçalho já é a autoridade única para alternar
tema claro/escuro.

## Escopo exclusivo

- Builder pode editar apenas `apps/admin/src/pages/settings/SettingsPage.tsx`
  e seu teste existente se a asserção ficar stale.
- Remover o estado local `dark`, o listener `geonexo-theme-change` associado à
  página, a função `changeTheme` e o bloco visual do card com heading
  `Aparência`/checkbox `Tema escuro`.
- Alterar o subtítulo para remover a palavra `Aparência`, preservando a
  descrição de instalação, localização e dados do dispositivo.
- Manter intactos GPS, listeners de permissão, storage persistente, instalação,
  catálogo offline, limpeza de dados, versão, update e todos os demais cards.

## Proteções

Não alterar `TopNavBar`, botão global, classe `dark`, localStorage key `theme`,
evento de tema, manifest, Service Worker, IndexedDB, rotas, CSS, framework ou
layout geral. O cabeçalho continua responsável por alternar e persistir o
tema; a remoção não deve criar uma segunda autoridade.

## Aceitação e QA

- Settings não contém heading `Aparência` nem checkbox `Tema escuro`.
- O cabeçalho mantém toggle claro/escuro, muda a classe/documento e persiste
  após reload.
- GPS, instalação, storage, mapas offline e demais conteúdo de Settings
  continuam presentes.
- Executar typecheck, lint, build e os testes node de contraste, superfícies e
  limites PWA. Validação nativa deve confirmar toggle no cabeçalho e reload.
- Não criar teste novo apenas para remoção visual simples; ajustar somente
  asserções existentes que comprovadamente dependam do card removido.

Parar se o tema do cabeçalho depender do estado de Settings, se a remoção
quebrar listeners de GPS/storage ou se exigir alteração global. O gate autoriza
somente a implementação delimitada acima.
