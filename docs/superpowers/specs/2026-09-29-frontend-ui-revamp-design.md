# Especificação de Design: Revamp de UI/UX do GeoNexo (Abordagem Híbrida)

## 1. Visão Geral
O GeoNexo passará por uma modernização completa de sua interface de usuário (UI) e experiência (UX) no frontend (`apps/admin`). A decisão arquitetônica principal é adotar uma **Abordagem Híbrida** baseada em três modalidades de visualização distintas, garantindo que a interface se adapte à tarefa que o usuário está executando, desde a gestão macro de projetos até a edição focada no mapa.

## 2. Modalidades da Interface

### Modo 1: Dashboard Studio (Foco em Gestão)
- **Baseado em:** Opção 1 (Sleek Spatial Studio).
- **Propósito:** Visão geral, gestão de projetos, métricas globais e configurações.
- **Layout:** 
  - Barra lateral de navegação proeminente.
  - Cartões de resumo (projetos ativos, importações recentes).
  - Listagens em formato de grade/tabela para projetos.
  - Menos ênfase no mapa; o mapa (se presente) atua apenas como visualização secundária (preview de extents).
- **Páginas Aplicáveis:** `/` (Dashboard), `/projects`, `/settings`.

### Modo 2: GIS Command Center (Foco em Dados e Camadas)
- **Baseado em:** Opção 2 (GIS Command Center).
- **Propósito:** Gerenciamento de um projeto específico, manipulação intensa de camadas (layers), visualização de tabelas de atributos e integrações.
- **Layout:**
  - Layout dividido (Split-pane).
  - Painéis laterais ricos para árvore de camadas (Layer Tree), propriedades de feições e legendas.
  - Mapa ocupando a maior parte da tela, mas ladeado por painéis de controle fixos.
  - Tabela de dados (Data Grid) colapsável na parte inferior.
- **Páginas Aplicáveis:** `/projects/$projectId` (Visão geral do projeto e manipulação de dados), `/imports`.

### Modo 3: Minimalist Canvas-First (Foco em Edição e Análise Espacial)
- **Baseado em:** Opção 3 (Minimalist Canvas-First).
- **Propósito:** O "Workspace" puro. Edição geométrica imersiva, digitalização, análises visuais onde o mapa é o protagonista absoluto.
- **Layout:**
  - Mapa *Full-bleed* (ocupa 100% da tela).
  - UI Flutuante (Floating UI): Ferramentas de desenho (Terra Draw), controles de zoom e seletor de mapa base aparecem como painéis flutuantes sobrepostos ao mapa, semelhantes a ferramentas de design modernas (ex: Figma).
  - Ocultamento automático ou minimização de painéis não essenciais.
- **Páginas Aplicáveis:** `/workspace` ou ao ativar o "Modo Tela Cheia/Foco" dentro de um projeto.

## 3. Transições e Fluxo do Usuário
A navegação entre essas modalidades deve ser fluida e não parecer que o usuário mudou de aplicação.
1. O usuário entra na plataforma e vê o **Dashboard Studio** (Modo 1).
2. O usuário clica em um Projeto e é levado ao **GIS Command Center** (Modo 2) para configurar camadas e ver os dados estruturados.
3. Quando o usuário precisa digitalizar novos polígonos ou focar apenas no mapa, ele clica no botão "Workspace / Modo Foco", expandindo a interface para o **Minimalist Canvas-First** (Modo 3). Um botão de "Voltar ao Projeto" restaura os painéis (Modo 2).

## 4. Tecnologias e Componentes
- **Framework UI:** Tailwind CSS + Radix UI (via `@geonexo/ui`). O design system precisa ser atualizado para suportar variações "flutuantes" (ex: botões com glassmorphism/backdrop-blur para o Modo 3).
- **Gerenciamento de Estado de Layout:** Zustand será usado para armazenar o estado atual dos painéis (abertos/fechados/flutuantes) e o modo de visualização ativo.
- **Mapa:** MapLibre GL JS + React Map GL (via `@geonexo/maps`). O contexto do mapa precisa persistir (se possível) ou carregar rapidamente durante as transições de rota entre o Modo 2 e Modo 3 para evitar re-renderizações demoradas e flashes na tela.

## 5. Riscos e Considerações
- **Desempenho (Renderização do Mapa):** Transitar entre páginas que contêm o mapa (Modo 2 -> Modo 3) pode causar recarregamentos caros do WebGL. *Mitigação:* Usar o cache do React Query para os dados do mapa ou estruturar o layout de forma que o componente `<Map>` permaneça montado na árvore DOM superior, se possível, apenas alterando os painéis de UI ao redor.
- **Consistência Visual:** Manter uma linguagem visual coerente apesar dos layouts diferentes. O tema (cores, tipografia, cantos arredondados) deve ser rigorosamente padronizado no `tailwind.config.ts`.

## 6. Próximos Passos
1. Obter aprovação desta especificação.
2. Iniciar a skill `writing-plans` para dividir a implementação nos seguintes épicos:
   - Épico 1: Atualização do Design System e Temas (`@geonexo/ui`).
   - Épico 2: Estrutura de Layout e Estado Global (Dashboard Layout vs. Workspace Layout).
   - Épico 3: Implementação das páginas do Modo 1 (Dashboard).
   - Épico 4: Implementação das páginas do Modo 2 (Project Command Center).
   - Épico 5: Implementação do Modo 3 (Canvas-First Workspace) e Ferramentas Flutuantes.
