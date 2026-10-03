# Guia de uso

## 1. Abrir o aplicativo

O GeoNexo pode rodar como PWA ou app Capacitor.

## 2. Projetos

A tela de projetos permite acessar os projetos locais. O aplicativo é projetado para continuar operando sem internet.

## 3. Mapa

Rotas principais observadas:

- `/projects/:projectId/map`
- `/workspace`

No mapa é possível trabalhar com camadas e feições geoespaciais.

## 4. GPS

Ao usar localização pela primeira vez, o sistema operacional pode solicitar permissão. Se negada, a aplicação deve permanecer utilizável sem inventar coordenadas.

## 5. Trabalho offline

Criações e edições são persistidas localmente. Não feche/limpe os dados do aplicativo se houver trabalho ainda não sincronizado.

## 6. Sincronização

Quando configurado em modo live e há rede, o mecanismo envia a outbox e depois busca mudanças remotas.

Conflitos não são resolvidos silenciosamente.

## 7. Importações e GeoPDF

Há tela de importações e suporte a GeoPDF georreferenciado. PDFs sem referência válida podem exigir calibração manual; calibração automática robusta ainda é pendente.

## 8. Atualizações

A PWA possui fluxo controlado de atualização. A atualização deve preservar dados duráveis locais; isso ainda precisa de confirmação em aparelho real para release.
