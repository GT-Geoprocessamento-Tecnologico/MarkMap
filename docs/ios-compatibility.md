# Compatibilidade iOS do MarkMap

## Alvo de suporte

O alvo é **iPhone X e modelos posteriores**, com o sistema atualizado para a versão disponível em cada aparelho. O piso desta entrega é **iPhone X com iOS 16.7/Safari 16**, não iOS 10. iPadOS também faz parte da revisão, incluindo Safari em modo desktop. Isso não significa que toda versão histórica do sistema de um aparelho seja suportada.

O núcleo é o mesmo aplicativo web instalado a partir de `https://appmarkmap.mtsferreira.dev/`. O projeto Capacitor existente tem configuração nativa própria; build, assinatura e publicação nativos exigem Xcode e validação separada. A versão web não publica um binário na App Store.

## Recursos e limites

| Recurso             | Compatibilidade e comportamento                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mapa e GLB          | Exigem WebGL2 e memória gráfica disponível. Não há engine alternativa ou garantia de execução após o sistema encerrar uma aba por falta de memória.                                                                                              |
| PDF/GeoPDF          | Main/worker PDF.js usam a mesma variante legada, com fallback para `Promise.withResolvers` somente quando ausente. Metadados, limites de entrada e de rasterização continuam validados. Um PDF sem referência não recebe coordenadas inventadas. |
| GeoJSON/GPX/KML/KMZ | O seletor não restringe extensões pelo filtro do sistema; a aplicação valida o conteúdo localmente. KMZ comprimido usa Compression Streams, presente no Safari 16.4 ou posterior.                                                                |
| Exportação          | O link de download é anexado ao documento e sua URL Blob permanece válida por uma janela de consumo limitada antes de ser liberada. Erros são apresentados; a ação do navegador/Arquivos depende do dispositivo.                                 |
| Instalação          | iPhone/iPad Safari mostram Compartilhar → Adicionar à Tela de Início. iPadOS com identidade desktop é reconhecido sem tratar macOS como iPad.                                                                                                    |
| Armazenamento       | IndexedDB e caches existentes são preservados. Storage Manager é opcional; suporte completo chega no Safari 17. Persistência depende da plataforma, das permissões e do espaço, e não impede toda remoção pelo sistema.                          |
| Busca offline       | Usa feições/índices dos dados baixados ou importados e consultas com resultado salvas localmente; não contém todos os endereços/CEPs do país.                                                                                                    |
| Altitude e GPS      | Altitude usa dados de terreno online ou grade previamente salva. A imagem/canvas DOM oferece alternativa quando ImageBitmap falha. GPS exige permissão e segue as restrições de execução em segundo plano do iOS.                                |

Safari e o aplicativo adicionado à Tela de Início podem ter armazenamentos separados. Verificar os arquivos no app instalado antes de depender deles em campo; não presumir transferência automática entre as duas instalações.

## Matriz obrigatória de verificação

- iPhone X: viewport 375×812, mapa e ferramentas, navegação, seletor sem filtro e importação com fixtures sintéticas.
- WebKit com APIs posteriores ao Safari 16 removidas: renderização real de PDF e worker, além do estado da página. Somente aceitar o arquivo ou não emitir erro no console não prova renderização.
- iPad em identidade desktop: instruções de instalação; macOS e browsers alternativos não devem ser confundidos com Safari iOS.
- Importar, visualizar sobre o mapa e reabrir os dados locais; exportar GeoJSON e original preservando bytes/nome.
- Busca local/CEP, consulta online e reuso offline; separar limitação de reload offline do WebKit no Playwright de falha do produto.
- Chrome: regressão dos mesmos recursos e atualização sobre a instalação existente.
- Dispositivo físico: instalação pela Tela de Início, permissões de localização, reinício/background, modo avião e PDF/pacote grande sob pressão de memória/espaço. Emulação WebKit e remoção de APIs não substituem essa etapa.

## Referências primárias

- [Apple: aparelhos compatíveis com iOS 16](https://support.apple.com/en-ie/103267)
- [WebKit: APIs do Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)
- [WebKit: Promise.withResolvers no Safari 17.4](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/)
- [WebKit: APIs do Safari 18.2](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/)
- [WebKit: política de armazenamento](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Apple WWDC23: armazenamento das instalações](https://developer.apple.com/videos/play/wwdc2023/10120/)
