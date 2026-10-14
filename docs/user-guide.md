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

## 9. Pacotes de mapa offline

Em **Armazenamento** é possível ver regiões instaladas, espaço usado, versão, data do mapa (OSM), update disponível, remover, reparar e ver detalhes/licenças.

- O download é **resumível**: se cair, retoma de onde parou.
- A ativação é **atômica**: um pacote só substitui o outro depois de validado
  (checksum e header conferidos). Se algo falhar, a região anterior continua
  ativa.
- Com o pacote instalado, mapa, busca, rota e elevação funcionam **sem
  internet** (modo avião).

## 10. Busca offline

A busca não chama servidor. O índice é particionado em shards por inicial e
acompanha o pacote da região:

- resultados ordenados por relevância com destaque do termo;
- aceita aproximação de digitação (fuzzy) e busca por prefixo;
- exibe distância quando a posição atual está disponível.

## 11. Rota e navegação

- perfis **a pé**, **bicicleta** e **carro**;
- origem/destino são ajustados à rede viária mais próxima;
- manobras (vire à esquerda/direita, rotatória, chegada) com texto falado em
  pt-BR gerado localmente — nenhum serviço de rota na nuvem;
- progresso da rota, distância para a próxima manobra, ETA e detecção de
  desvio com recálculo local.

## 12. Elevação e relevo

- altitude no cursor e em waypoints;
- perfil de elevação com distância, ganho, perda, mínimo e máximo;
- curvas de nível geradas localmente a partir do DEM do pacote.

## 13. Importar GPX e KML

A tela de importações aceita `.gpx` e `.kml` (waypoints, tracks e rotas) além
do GeoJSON. Os arquivos são tratados como **não confiáveis**: XML é validado
sem resolução de entidade externa e com limite de profundidade, e caminhos de
pacote não podem escapar do diretório lógico.


## Encontrar minha região, endereços e visualizar GeoPDF

1. No mapa ou em Configurações, abra **Baixar mapas**. Se o dispositivo já permitir localização, o MarkMap sugere o pacote disponível da área. Senão, toque em **Encontrar mapa da minha localização** ou pesquise o nome da região. Toque em **Baixar mapa** para confirmar. Sem cobertura publicada, aparece o aviso correto (não há download fictício).
2. No mapa, o atalho de **Buscar locais neste mapa** aceita nomes de ruas, lugares e endereços que estejam nos dados já instalados. Funciona sem internet. Busca online só será ativada mediante provedor de geocodificação contratado/configurado; não se utiliza API pública de terceiros como dependência oculta.
3. Na aba **Conjuntos de dados**, carregue o PDF. A carta aparece ajustada à tela, com **Ampliar para ler** disponível sem perda do arquivo original. Pontos de calibração permanecem na posição correta ao alternar a visualização.

### Download automático com autorização

Na tela **Baixar mapas**, ative **Baixar automaticamente o mapa da minha região** somente se quiser baixar um pacote quando ele estiver disponível. O app usa a permissão GPS já concedida e avisa que pode consumir internet móvel e espaço no aparelho. O aceite fica salvo no dispositivo e pode ser desligado a qualquer momento; a instalação só ocorre com internet e sem modo de economia de dados. Sem essa opção, toque em **Baixar mapa**. Se não há mapa publicado para a região, nada será baixado.
