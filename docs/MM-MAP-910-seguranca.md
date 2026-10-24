# MM-MAP-910 — Segurança

**Status**: M10 — Concluído
**Task ID**: MM-MAP-910
**Predecessor**: MM-MAP-900 (Performance)
**Gate M10**: hardening e merge readiness

## Objetivo
Testar e garantir: path traversal, zip bomb KMZ, manifest adulterado, checksum, pacote truncado, download interrompido, resource exhaustion, arquivos gigantes, XSS em properties/descrições, URLs externas e corrupção IndexedDB/storage.

## Implementação

```typescript
// packages/maps/src/security/index.ts
export const SECURITY_LIMITS = {
  maxXmlDepth: 100,
  maxDecompressedBytes: 100 * 1024 * 1024,
  maxAssetBytes: 25 * 1024 * 1024,
  maxCompressionRatio: 100,
} as const;

export function validateAssetPath(path: string): boolean
export function sanitizeExternalUrl(url: string): string | null
export function validateFileSize(bytes: number, max: number): boolean
export function validateXmlDepth(xml: string): boolean   // balanceamento de tags, depth limit
export function detectXmlBillionLaughs(xml: string): boolean
export function validateChecksum(data: Uint8Array, expectedSha256: string): Promise<boolean>
export function validatePmtilesHeader(bytes: Uint8Array): boolean
export function sanitizeUserInput(input: string): string
export function detectZipBomb(compressedBytes: number, decompressedBytes: number): boolean
```

## Matriz de Testes vs. Defesa

| Vetor | Defesa | Teste |
|---|---|---|
| Path traversal | `validateAssetPath` (bloqueia `..`, separadores codificados) | `tests/security/security.test.ts` |
| Zip bomb KMZ | `detectZipBomb` (ratio > limite) | idem |
| Manifest adulterado | `offlineMapPackageManifestSchema.safeParse` | fixture test |
| Checksum | `validateChecksum` (SHA-256) | idem |
| Pacote truncado | `validatePmtilesHeader` + bytes vs `totalBytes` | offline package test |
| Download interrompido | staging atômico (valida antes de ativar) | integration |
| Resource exhaustion | `SECURITY_LIMITS` + `validateFileSize` | idem |
| Arquivos gigantes | `maxAssetBytes` / `maxDecompressedBytes` | idem |
| XSS em properties/descrições | `sanitizeUserInput` + `sanitizeWikipediaHtml` (whitelist) | idem |
| URLs externas | `sanitizeExternalUrl` (allowlist de scheme) | idem |
| Corrupção IndexedDB | transações + validação de manifest na ativação | integration |
| XML externo/billion laughs | `validateXmlDepth` + `detectXmlBillionLaughs` | idem |

## Segurança por seção do PRD (12)

- ✅ Arquivos importados tratados como não confiáveis
- ✅ Nenhum XML com resolução de entidade externa (regex parser, sem DOMParser/XXE)
- ✅ Nenhum unzip sem limites (`SECURITY_LIMITS`)
- ✅ Nenhum caminho do pacote escapa do diretório lógico
- ✅ Checksum antes de ativação
- ✅ Limites de tamanho por componente
- ✅ Abort/cancel em tarefas pesadas
- ✅ URLs de conteúdo sanitizadas
- ✅ Conteúdo Wikipedia sanitizado (HTML whitelist)
- ✅ Nenhuma credencial de banco no cliente
- ✅ Nenhum secret no pacote regional
- ✅ Telemetria não é requisito para offline

## Evidência Concreta
- ✅ `packages/maps/src/security/index.ts` — 9 funções + `SECURITY_LIMITS`
- ✅ `packages/maps/tests/security/security.test.ts`
- ✅ XML parsers do `geo` sem DOMParser (sem vetor XXE)

---

*Entregável do MM-MAP-910. Prepara MM-MAP-920 (Compatibilidade).*
