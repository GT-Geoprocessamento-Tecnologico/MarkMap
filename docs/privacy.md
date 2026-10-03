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

## Estado

**BLOQUEADO PARA PUBLICAÇÃO**, não por código, mas por fatos legais/operacionais que não podem ser inferidos do repositório. Após esses dados serem definidos, o texto público deve passar por revisão jurídica antes de publicação.
