# PRD — Landing Page MarkMap v2

## Objetivo
Implementar no site público da MarkMap a landing aprovada visualmente pelo responsável, preservando identidade oficial e arquitetura existente.

## Contexto
O site público existe em `apps/site` (React + Vite + TypeScript). A referência aprovada usa hero cartográfico escuro, azul/ciano oficial, seções claras de benefícios/produto/offline e CTA final escuro.

## Escopo
- reconstruir a Home para seguir a referência aprovada;
- header com Produto, Recursos, Offline, Contato, alternância de tema e um único CTA "Baixar app";
- hero full-bleed com mapa cartográfico animado, headline e painel de benefícios;
- faixa de 4 benefícios;
- seção de produto com mockup de mapa/camadas;
- seção offline-first com 3 etapas;
- CTA final com mockup mobile e compatibilidade Android/iOS;
- botão global de voltar ao topo;
- tema claro/escuro com contraste legível;
- manter páginas secundárias já existentes.

## Fora do escopo
- deploy público;
- publicação em lojas;
- links de Google Play/App Store;
- alterações no app operacional;
- mudanças em IndexedDB, sync, API, Neon/PostGIS ou Capacitor;
- dependências novas sem necessidade comprovada.

## Arquivos afetados
- `apps/site/src/pages/HomePage.tsx`
- `apps/site/src/components/Header.tsx`
- `apps/site/src/components/HeroVisual.tsx`
- `apps/site/src/components/Footer.tsx`
- `apps/site/src/components/ThemeToggle.tsx`
- `apps/site/src/styles.css`
- opcionalmente `apps/site/index.html` para bootstrap do tema.

## Segurança
- nenhum secret no cliente;
- nenhum acesso direto ao banco;
- não introduzir conteúdo remoto obrigatório;
- preferência de tema pode usar localStorage por não ser dado sensível.

## Critérios de aceite
1. Apenas um botão "Baixar app" visível no header desktop.
2. Nenhuma menção a Google Play ou App Store.
3. Texto "Compatível com Android e iOS" presente.
4. Botão de tema funcional com estado persistente e fallback para preferência do sistema.
5. Botão "Voltar ao topo" funcional.
6. Contraste adequado em tema claro e escuro.
7. Hero e seções seguem a composição visual aprovada.
8. Animações respeitam `prefers-reduced-motion`.
9. Mobile sem overflow horizontal.
10. Footer mantém "Desenvolvido por MtsFerreira" com link seguro.

## Testes
- lint;
- typecheck;
- unit tests existentes;
- build;
- revisão de strings proibidas no site;
- validar navegação, tema, CTA e back-to-top;
- E2E/quality checks do repositório quando acionados pelo PR.

## QA
- desktop 1440px;
- tablet ~1024px;
- mobile 390px;
- tema claro e escuro;
- teclado/focus visible;
- reduced motion.

## Documentação
Atualizar este PRD e o PR com o resultado final. Atualizar Handoff/Checklist se houver mudança relevante de fase/arquitetura/bloqueio.

## Git
Continuar na branch existente `feat/site-modernization` e PR #4. Não alterar `main` diretamente. Revisar diff antes de concluir.

## Ações proibidas
- deploy/release/publicação;
- force push;
- reset destrutivo;
- migration;
- alteração de secrets;
- alteração de código operacional fora de `apps/site`.

## Riscos
- contraste insuficiente ao alternar tema;
- excesso de motion em mobile;
- hero perder legibilidade sobre textura cartográfica;
- duplicação de CTA no header/mobile;
- regressão visual em páginas secundárias compartilhando estilos.

## Relatório final esperado
- arquivos alterados;
- validações executadas/estado de CI;
- riscos pendentes;
- link do PR;
- confirmação de ausência de menções a lojas.
