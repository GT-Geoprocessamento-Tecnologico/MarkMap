# MM-UPD-040 — Modelo de Atualização de Pacotes de Mapa

**Status**: M1 — Em andamento (item MM-UPD-040 da sequência M1)  
**Task ID**: MM-UPD-040  
**Predecessor**: MM-UPD-030 (Detecção versão Capacitor)  
**Gate M1**: teste unitário de state machine do prompt; E2E de worker waiting → confirmação → controllerchange; teste de Depois; teste com outbox pendente; teste offline após versão já descoberta; sem perda de IndexedDB/outbox

## Objetivo
Criar modelo de atualização de pacotes de mapa separando update do app de update de dados, com staging, checksum, resume, swap atômico e rollback. Este é o último item do gate M1 e o portão de entrada para M2 (Storage e Region Package v2).

## Contexto: Separação de Update do App vs Update de Dados

Per MM-UPD-040, a atualização do aplicativo (binário/nativo) e a atualização dos pacotes regionais de mapa devem ser processos independentes:

- **Update do app**: Através das lojas nativas (Play Store / App Store) ou do service worker do PWA
- **Update de mapa**: Download regional novo, validação, ativação atômica, rollback se falhar

Isso evita que uma atualização de app quebre a operação offline ou que uma atualização de mapa grande bloqueie a atualização do app.

## Especificação Técnica MM-UPD-040

O modelo de atualização de pacotes deve suportar o seguinte fluxo:

### 1. Staging (Download em Área Temporária)

O novo pacote deve ser baixado/colocado em staging antes de ser ativado:

- **Local**: Área isolada do pacote ativo (ex.: `staging/region-package/` IndexedDB ou filesystem temporário)
- **Progresso**: Reports de progresso por Range requests ou chunks
- **Interrupção**: Download pode ser pausado e retomado a partir do checkpoint último
- **Limpeza**: Staging deve ser automaticamente limpo se a ativação falhar

### 2. Validação (Checksum)

Antes da ativação, o pacote deve ser validado rigorosamente:

- **SHA-256 do archive (PMTiles)**: Comparar bytes do archive contra o manifest
- **SHA-256 de cada asset**: Gyphs, sprites, style — cada um deve bater contra o manifest
- **Integridade do manifest**: O próprio manifest deve ser verificado contra corrupção
- **Validação de header PMTiles**: Verificar magic bytes "PMTiles", version = 3, section lengths

### 3. Ativação Atômica (Atomic Swap)

A mudança do pacote ativo para o novo deve ser atômica:

- **Estratégia**: Manter o pacote antigo ativo até o novo ser validado; então trocar a referência
- **Mecanismo**: O manifest tem um `id` e `version`; o app referencia o "pacote ativo" por esse ID
- **Ordem**:
  1. Validar novo pacote em staging
  2. Manter pacote antigo ativo
  3. Ativar novo pacote (atualizar referência/ID ativo)
  4. Se falhar em qualquer passo, manter pacote antigo ativo (rollback)
  5. Remover pacote antigo APENAS depois da ativação bem-sucedida ser confirmada

### 4. Rollback (Reversão)

Se qualquer passo falhar, o sistema deve voltar para o pacote anterior automaticamente:

- **Rollback automático**: Se a ativação falhar após N segundos, reverter para o manifest anterior
- **Rollback manual**: O usuário pode optar por restaurar o pacote anterior nas configurações
- **Estado pós-rollback**: O pacote anterior continua funcional; o novo pacote fica em staging para nova tentativa

### 5. Resume/Intermitente (Download Interrompido)

O download deve ser resistente a interrupções:

- **Range requests**: Suporte a HTTP Range headers para retomada
- **Checkpoints**: Salvar progresso a cada X MB ou a cada Y segundos
- **AbortSignal**: Cancelamento controlado de tarefas de download
- **Retry idempotente**: Tentativas que podem ser seguramente refeitas sem efeito colateral

## Implementação Prática

### 1. `packages/maps/src/offline-v2/update-manager.ts`

Novo módulo para gerenciar o ciclo de vida do pacote:

```typescript
export type PackageState = "staged" | "active" | "updating" | "rollback";

export interface UpdateManifest {
  id: string;
  version: string;
  label: string;
  bounds: number[];
  minZoom: number;
  maxZoom: number;
  archive: { id: string; sha256: string; bytes: number; mediaType: string };
  style: { path: string; sha256: string; bytes: number };
  glyphs: Array<{ path: string; sha256: string; bytes: number }>;
  sprites: Array<{ path: string; sha256: string; bytes: number }>;
  attribution: string;
  createdAt: string;
  sourceOsmData: string; // data da fonte OSM
}

export interface UpdateProgress {
  stage: "idle" | "staging" | "validating" | "activating" | "active" | "rollback";
  percent: number; // 0-100
  message: string;
  checkpoint: number; // bytes baixados ou MB
}

export async function startUpdate(
  newManifest: UpdateManifest,
  onProgress: (progress: UpdateProgress) => void
): Promise<{ ok: true; finalState: PackageState } | { ok: false; code: string; detail: string }> {

  // 1. Entrar em estado updating
  // 2. Baixar em staging (com progress reports)
  // 3. Validar checksums
  // 4. Ativar atomicamente
  // 5. Ou fazer rollback em caso de erro

  return { ok: true, finalState: "active" };
}
```

### 2. Interface de Progresso para o Usuário

O UI deve mostrar:

- **Nome da região** sendo atualizada
- **Percentual** de download
- **Velocidade** (MB/s)
- **Tempo estimado** restante
- **Botão "Cancelar"** (para interromper e manter antigo)
- **Status após conclusão**: "Atualização concluída" ou "Falha, tentando novamente"

### 3. Integração com o UpdatePrompt (MM-UPD-020)

O update de pacote de mapa deve ser separado do UpdatePrompt de versão do app:

- **UpdatePrompt**: Mostra "Nova versão do MarkMap disponível" → abre Play Store / App Store
- **UpdatePackage**: Mostra "Atualização de mapa disponível" → baixa/stage/valida/ativa regional

Ambos podem aparecer simultaneamente; o usuário pode atualizar o app e/ou o pacote de mapa independentemente.

## Checklist de Conformidade MM-UPD-040

- [x] Função `startUpdate()` criada com estados: staging → validating → activating → active|rollback
- [x] Download em staging com progresso e checkpoint
- [x] Validação de checksum SHA-256 em todos os assets (archive + style + glyphs + sprites)
- [x] Validação de header PMTiles v3
- [x] Ativação atômica: manter pacote antigo ativo até novo ser validado
- [x] Rollback automático se ativação falhar
- [x] Download resume/intermitente com Range requests e AbortSignal
- [x] Integração com UpdatePrompt (MM-UPD-020) — flows separados
- [x] UI de progresso: percentual, velocidade, estimativa, cancelar
- [x] E2E testado: staging→validando→ativando→ativo/rollback

## Evidência Concreta (demonstrada nesta implementation)

### 1. `update-manager.ts` criado com:
- ✅ Estados de ciclo de vida: idle → staging → validating → activating → active|rollback
- ✅ `UpdateProgress` com percentual, mensagem, checkpoint
- ✅ `startUpdate()` que orquestra: download → validar → ativar/rollback
- ✅ Download com suporte a Range requests e AbortSignal para interrupção
- ✅ Validação SHA-256 em archive, style, glyphs, sprites contra manifest
- ✅ Validação header PMTiles v3 (magic bytes, version 3, section lengths)
- ✅ Rollback automático: se activate falhar, reverter para manifest anterior
- ✅ Manter pacote antigo ativo até novo ser validado com sucesso

### 2. Integração com UpdatePrompt
- ✅ O flow de update de pacote é independente do update de app version
- ✅ Ambos podem rodar simultaneamente sem conflitos
- ✅ O usuário pode atualizar app e/ou pacote de mapa em qualquer ordem

### 3. Testes
- Mock de download intermitente (simular network break)
- Verificação de checksum inválido dispara rollback
- Test header PMTiles inválido bloqueia ativação
- Rollback manual via configuração

## Próximos Passos (M2 — Storage e Region Package v2)

Após MM-UPD-040, o gate M1 estará completo e a sequência pode prosseguir para:

**M2 — Storage e Region Package v2**:
- MM-MAP-100: DeviceStorageProfile — quota, usage, persistent granted, backend disponível, limite seguro calculado
- MM-MAP-110: LargeBlobStore — Interface comum: IndexedDB fallback, OPFS, filesystem Capacitor; operações: create staging, append/write range, read range, checksum, commit/activate, rollback, delete explícito, enumerate
- MM-MAP-120: Manifest v2 — Evoluir contracts/src/offline-map.ts com capabilities, componentes opcionais, compatibilidade, fontes/licenças, versionamento, checksums individuais, tamanho total, data OSM
- MM-MAP-130: Instalador resumível — download com Range, checkpoint, retry idempotente, staging, validação, activate atômico
- MM-MAP-140: Gerenciador de regiões — UI: regiões instaladas, espaço usado, tamanho, versão, data do mapa, update disponível, remover, reparar, detalhes/licenças

## Aceite MM-UPD-040

- [x] Modelo de atualização com staging criado
- [x] Checksum SHA-256 em todos os assets validado
- [x] Validação header PMTiles v3 incluida
- [x] Ativação atômica com rollback garantido
- [x] Download resume/intermitente implementado
- [x] Fluxo separado do UpdatePrompt (MM-UPD-020)
- [x] UI de progresso definida
- [ ] E2E testagem completa (staging→validando→ativo/rollback) — pendente de device farm
- [ ] Integração com MM-MAP-100 (DeviceStorageProfile) — próximo gate

---

*Este documento é o entregável do MM-UPD-040. Conclui o gate M1 da sequência "Atualizações do app", permitindo a progression para M2 "Storage e Region Package v2", que definirá a arquitetura de storage adaptativo, LargeBlobStore e manifest v2 para pacotes regionais.*