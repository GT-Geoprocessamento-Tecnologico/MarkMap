# Privacidade

Este documento registra o estado técnico e os **insumos necessários** para a política pública. Ele não inventa dados jurídicos/operacionais que ainda não existem no repositório.

## Dados potencialmente tratados

Conforme funcionalidades atuais, o produto pode processar:

- localização/GPS;
- geometrias desenhadas;
- projetos, mapas, camadas e feições;
- arquivos/importações GIS e PDF;
- metadados técnicos de sincronização;
- identificadores técnicos de instalação/workspace.

## Comportamento técnico comprovado

- a operação principal é local-first em IndexedDB;
- sincronização remota ocorre quando há rede e modo live configurado;
- workspace capability é autoridade técnica, não conta de identidade;
- banco privilegiado não é exposto ao navegador;
- storage remoto, quando habilitado, usa namespace por workspace;
- GPS depende da permissão do navegador/SO;
- não há base no repositório para afirmar retenção legal, prazo de exclusão ou identidade do controlador.

## Maps Engine v2 offline — avaliação de novos dados

A iniciativa `feat/maps-engine-v2-offline` **não introduz novas categorias de
dado pessoal**. Avaliação por recurso:

| Recurso                   | Dado pessoal novo?             | Comportamento                                                                           |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| Pacotes regionais de mapa | Não                            | conteúdo público (OSM/DEM/transito) baixado pelo usuário; metadados ficam locais        |
| Busca offline             | Não                            | consultas ficam no dispositivo; o índice é local e **nenhuma consulta sai do aparelho** |
| Rota/navegação            | Não                            | cálculo local em Web Worker; nenhuma origem/destino é enviada a serviço externo         |
| Elevação/contours         | Não                            | amostragem local do DEM empacotado                                                      |
| Extratos Wikipedia        | Não                            | conteúdo público; apenas extratos permitidos, com atribuição                            |
| TTS                       | Não                            | fala gerada pelo SO/browser, texto montado localmente                                   |
| Download de região        | Metadados de instalação locais | tamanho, versão e data do mapa; sem identidade                                          |

Comportamento técnico comprovado adicional:

- nenhum telemetria é requisito para o modo offline (PRD, seção 12);
- nenhuma credencial de banco nem secret vai para o cliente ou para o pacote
  regional;
- URLs de conteúdo são sanitizadas e restritas a allowlist de schemes;
- rastreabilidade de licença/atribuição fica no manifesto do pacote e em
  `THIRD_PARTY_NOTICES.md`, sem coleta de dados do usuário.

Consequência para a política: nenhuma categoria nova a declarar. Os 10 itens
que faltam para publicar a política (abaixo) continuam válidos e não foram
alterados por esta iniciativa.

## Dados que faltam para publicar uma política

Antes de distribuição pública, o responsável precisa definir e revisar:

1. identidade jurídica/nome do controlador;
2. canal público de contato/privacidade;
3. finalidade oficial de cada categoria de dado;
4. base legal aplicável por jurisdição;
5. política e prazos de retenção/exclusão;
6. provedores efetivamente usados em produção e respectivos papéis;
7. países/regiões de processamento, se aplicável;
8. procedimento para solicitações do titular;
9. regras sobre fotos/arquivos caso essas funções sejam habilitadas;
10. URL pública onde a política será hospedada.
