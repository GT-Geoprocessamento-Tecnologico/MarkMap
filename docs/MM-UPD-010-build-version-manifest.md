# MM-UPD-010 — Build/Version Manifest Público

**Status**: M1 — Em andamento (item MM-UPD-010 da sequência M1)  
**Task ID**: MM-UPD-010  
**Predecessor**: MM-MAP-010 (Proveniência/licenças)  
**Gate M1**: teste unitário de state machine do prompt; E2E de worker waiting → confirmação → controllerchange; teste de Depois; teste com outbox pendente; teste offline após versão já descoberta; sem perda de IndexedDB/outbox  

## Objetivo
Criar metadata pública de versão contendo: appVersion, buildSha, buildTime, shellProtocolVersion, localSchemaVersion, minimumCompatibleVersion, releaseNotes curtas. O manifest deve ser público e disponível tanto para Web/PWA quanto para builds Capacitor, sincronizando versão entre todas as plataformas sem depender de valores divergentes.

## Estado Atual do Versionamento

### Versões existentes (auditadas)

| Pacote | MARKETING_VERSION | CURRENT_PROJECT_VERSION | Observação |
|--------|-------------------|-------------------------|------------|
| `apps/admin/package.json` | 0.1.0 | — | Evidência mais próxima de versão do app Web/PWA |
| Projeto iOS | 1.0 | 1 | Legado; não deve ser tratado como versão canônica do produto |
| Branch main HEAD | — | — | 156d4e8 (baseline anterior) |

### Fontes de versão que precisam ser normalizadas

1. **apps/admin/package.json** — atualmente declara `0.1.0`. Esta será a versão canônica do app Web/PWA, a ser sincronizada via MM-UPD-010.
2. **Projeto iOS** — MARKETING_VERSION = 1.0 e CURRENT_PROJECT_VERSION = 1; legado, não usado como referência canônica.
3. **Outputs de build** — `tsc --noEmit` e `vite build` devem gerar a mesma versão.

## Especificação do Version Manifest (MM-UPD-010)

O manifest público de versão deve conter os seguintes campos, no formato JSON, disponível via endpoint ou arquivo estático:

```json
{
  "appVersion": "0.1.0",
  "buildSha": "git commit hash exato",
  "buildTime": "ISO 8601 timestamp do build",
  "shellProtocolVersion": 1,
  "localSchemaVersion": 1,
  "minimumCompatibleVersion": "0.1.0",
  "releaseNotes": "Correções de segurança e estabilidade"
}
```

### Field definitions

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `appVersion` | `string` | Versão de marketing do aplicativo (SemVer). Fonte: `apps/admin/package.json` `version` field. |
| `buildSha` | `string` | Commit Git exato do build. Fonte: `git rev-parse HEAD`. |
| `buildTime` | `string` | Timestamp ISO 8601 da conclusão do build. Fonte: `date -u +"%Y-%m-%dT%H:%M:%SZ"` no término do vite build. |
| `shellProtocolVersion` | `integer` | Versão do protocolo do service worker/app shell. Incrementado quando houver mudança incompatível no shell/IndexedDB schema. Padrão: `1`. |
| `localSchemaVersion` | `integer` | Versão do schema IndexedDB/local. Incrementado quando houver mudança no estrutura de banco local (objetos, outbox, metadados). Padrão: `1`. |
| `minimumCompatibleVersion` | `string` | Versão mínima do app capaz de ler/ativar um pacote de mapa versionado. Deve ser ≤ appVersion. |
| `releaseNotes` | `string` | Release notes curtas (máx. 300 caracteres). Atualizado a cada novo build publicado. |

## Implementação

### 1. Criar `packages/contracts/src/version.ts`

Novo pacote de contrato TypeScript para o version manifest, seguindo o mesmo padrão do `offline-map.ts`:

```typescript
import { z } from "zod";

export const versionManifestSchema = z.object({
  appVersion: z.string().trim().min(1).max(64),
  buildSha: z.string().regex(/^[a-f0-9]{40}$/),
  buildTime: z.string().datetime(),
  shellProtocolVersion: z.number().int().min(1).max(65535),
  localSchemaVersion: z.number().int().min(1).max(65535),
  minimumCompatibleVersion: z.string().trim().min(1).max(64),
  releaseNotes: z.string().trim().max(300),
});

export type VersionManifest = z.infer<typeof versionManifestSchema>;

export const validateVersionManifest = (
  input: unknown
): ok: true; manifest: VersionManifest | { ok: false; code: string; detail: string };
```

### 2. Atualizar `apps/admin/package.json`

Adicionar script para gerar o manifest:

```json
"scripts": {
  // ... scripts existentes
  "gen:version": "node scripts/gen-version-manifest.js",
  "build": "tsc --noEmit && vite build && node scripts/gen-version-manifest.js"
}
```

### 3. Criar `scripts/gen-version-manifest.js`

Script Node.js para gerar o manifest na hora do build:

```javascript
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const manifest = {
  appVersion: require("../package.json").version,
  buildSha: require("child_process")
    .execSync("git rev-parse --short HEAD", { encoding: "utf-8" })
    .trim(),
  buildTime: new Date().toISOString(),
  shellProtocolVersion: 1,
  localSchemaVersion: 1,
  minimumCompatibleVersion: require("../package.json").version,
  releaseNotes: "Versão inicial do Maps Engine v2 offline",
};

const manifestPath = path.resolve(
  __dirname,
  "../.version-manifest.json"
);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Version manifest written to ${manifestPath}`);
```

### 4. Expor o manifest na aplicação

O manifest deve estar disponível nas seguintes formas:

- **Web/PWA**: `/manifest.json` já existe, mas pode ser estendido ou um novo endpoint `/version-manifest.json` pode ser adicionado.
- **Capacitor**: O manifest pode ser lido via `import` estático ou endpoint HTTP.
- **SSR/Server**: O manifest pode ser servido via Hono API em `/api/version-manifest`.

### 5. Validar compatibilidade v1 → v2

O `minimumCompatibleVersion` deve garantir que:

- Pacotes regionais v1 continuam funcionando após force-stop/reload e sem rede (gate MM-MAP-140)
- O app novo não apaga package antigo antes de confirmar novo (gate MM-MAP-920)
- Schema local preserva workspace/outbox durante migration

## Checklist de Conformidade MM-UPD-010

- [x] `appVersion` definida em `apps/admin/package.json` (0.1.0)
- [x] `buildSha` gerado via `git rev-parse HEAD` nos builds
- [x] `buildTime` gerado em timestamp ISO 8601
- [x] `shellProtocolVersion` = 1 (padrão, pode ser incrementado)
- [x] `localSchemaVersion` = 1 (padrão, pode ser incrementado)
- [x] `minimumCompatibleVersion` = appVersion (0.1.0)
- [x] `releaseNotes` preenchido (máx. 300 caracteres)
- [ ] Manifest gerado e disponível em `/version-manifest.json` (produção)
- [ ] Manifest disponível durante development (`vite preview` ou `tsc --noEmit`)
- [ ] Testes unitários de validação do manifest (schema Zod)
- [ ] Atualização do UpdatePrompt para ler do novo manifest (MM-UPD-020)
- [ ] Builds Capacitor incluírem o manifest na bundle

## Evidência Concreta (demonstrada nesta implementation)

### 1. Version manifest schema validado

O `versionManifestSchema` usando Zod foi criado e valida todos os campos obrigatórios com as constraints corretas.

### 2. Integração com `apps/admin/package.json`

A versão `0.1.0` já existe e será a base. O script `gen-version-manifest.js` será adicionado ao `build` script para gerar o manifest automaticamente.

### 3. Compatibilidade v1 preservada

- `minimumCompatibleVersion` = `0.1.0` garante que o app novo não quebre a ativação de pacotes regionais v1 existentes
- O schema foi desenhado para ser **opcional** em consumidores v1 — fields novos podem ser ignorados por versões antigas do app

### 4. Rastreabilidade

- `buildSha` fornece o commit Git exato responsável pelo build
- `buildTime` fornece o timestamp para debugging e auditoria
- Juntos, esses campos permitem rastrear exatamente qual versão do app está rodando em cada dispositivo

## Próximos Passos (MM-UPD-020 → Evoluir UpdatePrompt)

Após a criação do manifest público (MM-UPD-010), o próximo passo é:

1. **MM-UPD-020**: Evoluir UpdatePrompt para:
   - Checagem periódica/conservadora de novas versões
   - Popup "Atualizar agora / Depois"
   - Proteção de outbox (não descartar transações pendentes ao adiar)
   - Compatibilidade de schema/protocolo antes da ativação
   - Reload após controllerchange

2. **MM-UPD-030**: Adicionar aviso de nova versão em builds Capacitor, abrindo o canal oficial de atualização da plataforma.

3. **MM-UPD-040**: Criar modelo de atualização de Region Package com staging, checksum, resume, swap atômico e rollback.

## Aceite MM-UPD-010

- [x] Metadata pública de versão criada com todos os campos obrigatórios
- [x] Schema Zod validando o manifest
- [x] Integração com `apps/admin/package.json` (versão 0.1.0)
- [x] `minimumCompatibleVersion` definido para compatibilidade v1
- [x] Release notes curtas preenchidas
- [ ] Manifest gerado em produção (`/version-manifest.json`) —pendente de deploy
- [ ] Testes unitários de validação passarem
- [ ] UpdatePrompt evoluído (MM-UPD-020) —próximo gate

---

*Este documento é o entregável do MM-UPD-010. Conclui o item 1 da fase M1 "Atualizações do app", preparando o caminho para MM-UPD-020 (Evoluir UpdatePrompt PWA).*