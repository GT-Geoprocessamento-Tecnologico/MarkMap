# ADR-0005 — Storage regional grande com LargeBlobStore multi-backend

**Status:** Accepted

## Contexto

Pacotes regionais, DEM raster e shards de busca são grandes demais para caber de forma prática apenas em records do IndexedDB. O navegador pode negar storage persistente e o Capacitor pode expor filesystem nativo. É preciso um único contrato de API para staging, escrita por faixa, checksum e ativação, sem trocar a lógica de negócio a cada backend.

## Decisão

1. **`LargeBlobStore`** como interface única com implementações para
   IndexedDB (fallback), OPFS e filesystem do Capacitor quando adotado.
2. Operações mínimas exigidas pela interface:
   `create staging`, `append/write range`, `read range`, `checksum`,
   `commit/activate`, `rollback`, `delete` explícito, `enumerate`.
3. **`DeviceStorageProfile`** é a autoridade sobre quota, uso, `persisted`
   grant, backend disponível e limite seguro calculado; nada baixa acima do
   limite seguro sem consentimento.
4. **Nomes por workspace** para não misturar regiões de workspaces distintos.
5. Índices de busca ficam **sharded** por primeira letra normalizada
   (MM-MAP-410) para não carregar o índice inteiro em memória.

## Consequências

- mesma lógica de staging/ativação roda em web e Capacitor;
- download interrompido é retomável porque o estado vive no staging, não em
  memória;
- `rollback` é repontear o ativo — não requer novo download;
- storage persistido pode ser negado pelo SO → o app continua funcional em
  storage volátil, apenas sem garantia de sobreviver a limpeza;
- nunca apagar `workspace`/`outbox` ao remover uma região (migração de schema é
  aditiva).

Relacionado: MM-MAP-110, MM-MAP-100, MM-MAP-130, MM-MAP-140, MM-MAP-920.
