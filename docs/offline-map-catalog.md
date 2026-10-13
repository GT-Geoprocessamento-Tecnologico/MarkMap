# Catálogo de mapas offline — MarkMap

**Desenvolvido por MtsFerreira.** O usuário final não deve editar URLs, manifests ou pacotes PMTiles.

## Uso no aplicativo

- **Mapa → Baixar mapas**: escolher uma região, ver tamanho e fonte, baixar e usar offline. Regiões que incluem o centro do mapa aparecem primeiro.
- **Configurações → Mapas offline**: mesma lista pesquisável; mapas já instalados podem ser selecionados e gerenciados, sem depender da internet.
- A importação por pasta e o manifest HTTPS continuam preservados em **Opções avançadas**, voltados a administradores.

## Publicação do catálogo pela equipe

O arquivo `apps/admin/public/maps/catalog.json` é servido como `/maps/catalog.json` na **origem do aplicativo**, nunca na origem do site. O esquema é fixo:

```json
{
  "version": 1,
  "regions": [
    {
      "id": "id-do-pacote",
      "label": "Nome exibido para o usuário",
      "area": "Estado ou região",
      "manifestUrl": "https://servidor-autorizado.example/regiao/manifest.json",
      "bounds": [-49, -8, -47, -6],
      "sizeBytes": 1234567,
      "attribution": "Fonte e licença comprovadas"
    }
  ]
}
```

**O exemplo acima é ilustrativo, não é mapa disponível.** O catálogo publicado começa em `{"version":1,"regions":[]}` porque o HEAD auditado não possui nenhum pacote regional distribuído/verificado.

Uma região só deve entrar após publicar os arquivos `package.pmtiles`, `style.json`, sprites, glyphs e complementos exigidos pelo seu **manifest real**, hospedados no mesmo diretório HTTPS com CORS e HTTP Range configurados. Validar:
- Direitos de redistribuição, origem e atribuição conforme a licença; nunca fazer bulk download de tiles de servidores OSM públicos.
- `manifestUrl` HTTPS público sem credenciais, hash ou query, sem redirecionamento. `id`, `bounds` e `sizeBytes` do catálogo devem corresponder **exatamente** ao manifest verificado.
- `offlineMapPackageManifestSchema`, versão compatível, SHA-256 de todos os assets, PMTiles válido e orçamento local de 250 MiB.
- Download no Android/Windows e reinstalação offline com Service Worker. Catálogo é metadado, **não** salva mapas: IndexedDB + checkpoints verificados são fontes operacionais.
- Um mapa não deve ser marcado como disponível se os arquivos, licenciamento, CORS ou tamanho não foram validados.

A interface distingue catálogo vazio de falha de conexão; mapas já instalados continuam selecionáveis offline. A atualização de um download parcialmente salvo de outra versão exige confirmação explícita. O app seleciona a nova região apenas após instalação íntegra.

## Pendência de dados reais

A70 implementa a **experiência e a integração**, não fabrica mapas. O trabalho de distribuição regional (A71) deverá preparar, hospedar, verificar e publicar os primeiros pacotes licenciados. Sem essa entrega, o catálogo ficará vazio e nenhum download novo será oferecido. Não afirmar paridade de cobertura com Organic Maps.

## Regra de regressão

Preservar `apps/admin/src/lib/storage/resumable-installer.ts`, `offlineMapStore`, sistema de mapas instalado, opções avançadas e separação dos dois subdomínios. Testes previstos: `public-region-catalog.test.ts`, `catalog-region-install.test.ts` e `apps/admin/e2e/map-download-catalog.spec.ts`. Validação física quando fontes reais estiverem publicadas.


## GPS e seleção de mapas (A71)

O catálogo oferece **Encontrar mapa da minha localização**. Na abertura, só consulta GPS quando o sistema operacional já concedeu permissão; se não, solicita somente ao tocar no botão. Usa `lon/lat` no dispositivo para priorizar a menor região publicada que contenha o ponto; **não envia coordenadas para o catálogo nem para o servidor**. Se a posição estiver fora da cobertura, mostra aviso e mantém escolha por nome.

Nenhum download é automático apenas por conceder permissão GPS: o usuário confirma **Baixar mapa** com o tamanho visível, evitando cobranças e armazenamento inesperados. Como `apps/admin/public/maps/catalog.json` ainda não contém pacotes publicados, a aplicação não consegue baixar regiões reais até o time publicar arquivos licenciados com checksums válidos.
