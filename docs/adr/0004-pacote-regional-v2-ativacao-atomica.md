# ADR-0004 — Pacote regional v2 com ativação atômica

**Status:** Accepted

## Contexto

Pacotes regionais de mapa cresceram além do teto antigo de 250 MiB e o download pode ser interrompido. App antigo não pode ativar um pacote que ele não entende, e app novo não pode perder o pacote atual se o download falhar. O manifest v1 não carregava informação suficiente de compatibilidade, fontes ou checksums por componente.

## Decisão

1. **Manifest v2** (`packages/contracts/src/offline-map.ts`) com campos obrigatórios novos:
   `packageVersion`, `minimumCompatibleVersion`, `osmDataDate`, `capabilities`,
   `checksums` (por componente), `totalBytes`, `sources` (fonte + atribuições),
   `optionalComponents`.
2. **Ativação atômica**: download para staging → validação completa
   (schema + SHA-256 + header PMTiles + limites) → troca do ponteiro ativo →
   só então remoção do pacote anterior.
3. **Compatibilidade por versionamento**: app compara `minimumCompatibleVersion`
   com o seu schema. App v1 falha no `safeParse` (campos ausentes) e não ativa
   o pacote — comportamento desejado.
4. **Download resumível**: `Range` com checkpoint e retry idempotente quando o
   servidor suporta; sem suporte, cai para download completo.

## Consequências

- app antigo nunca ativa pacote incompatível (falha de schema, não de runtime);
- app novo mantém pacote anterior até o novo ser validado → rollback barato;
- `totalBytes`/`checksums` permitem detectar pacote truncado ou adulterado antes
  de ativar;
- `sources`/`attributions` garantem rastreabilidade de licença por região;
- camada de staging consome espaço temporário extra (mitigado por
  `DeviceStorageProfile`);
- removido o teto fixo de 250 MiB — o limite passa a ser o storage disponível.

Relacionado: MM-MAP-120, MM-MAP-130, MM-MAP-920.
