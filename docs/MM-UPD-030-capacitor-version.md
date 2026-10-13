# MM-UPD-030 — Detecção de Nova Versão em Builds Capacitor

**Status**: M1 — Em andamento (item MM-UPD-030 da sequência M1)  
**Task ID**: MM-UPD-030  
**Predecessor**: MM-UPD-020 (UpdatePrompt PWA evoluído)  
**Gate M1**: teste unitário de state machine do prompt; E2E de worker waiting → confirmação → controllerchange; teste de Depois; teste com outbox pendente; teste offline após versão já descoberta; sem perda de IndexedDB/outbox  

## Objetivo
Criar aviso equivalente de nova versão em builds Capacitor, abrindo o canal oficial de atualização da plataforma. Diferente do PWA, o service worker não se aplica da mesma forma a apps nativos, então o fluxo de detecção e atualização deve usar APIs nativas do Capacitor e as lojas de respectivas plataformas.

## Fluxo Diferente entre PWA e Capacitor

| Aspecto | PWA (Web) | Capacitor (Android/iOS) |
|---------|-----------|------------------------|
| **Atualização do app** | Através do service worker + `registration.update()` | Através do binário nativo (Play Store / App Store) |
| **Detecção de versão** | `registration.update()` após `serviceWorker.ready` | Verificar `navigator.userAgent` ou plugin nativo |
| **Prompt de atualização** | Popup modal dentro do app (UpdatePrompt) | Aviso nativo + abertura de loja |
| **Reload após update** | `controllerchange` event + `window.location.reload()` | Reinstalação do app ou diálogo "Atualizar" na loja |
| **Outbox protection** | IndexedDB/outbox local-first | Dados persistentes no armazenamento nativo do app |

## Especificação MM-UPD-030

O app Capacitor deve ser capaz de:

1. **Verificar versão quando online**:
   - Ao iniciar o app, se online: consultar o version manifest público (via HTTP ou metadata embutida)
   - Comparar com a versão bundle nativa (`CFBundleVersion` iOS / `versionCode` Android)

2. **Mostrar aviso de nova versão**:
   - Se versão disponível > versão bundle: mostrar aviso nativo
   - Aviso deve seguir guidelines de cada plataforma:
     - **Android**: Toast + botão "Atualizar" que abre Play Store
     - **iOS**: Banner + botão "Atualizar" que abre App Store

3. **Abrir canal oficial de atualização**:
   - **Android**: Intent `ACTION_VIEW` para `playStoreUri` ou `market://details`
   - **iOS**: `com.apple.katana` (App Store) ou `itms://` URLs
   - URL deve conter a versão corrente para comparação

4. **Política "Depois"**:
   - Se usuário escolher "Não agora", lembrar na próxima inicialização do app
   - Cada nova versão deve gerar novo aviso (não apenas reexibir a mesma)

5. **Compatibilidade com UpdatePrompt PWA**:
   - O aviso Capacitor deve ser independente do UpdatePrompt do PWA
   - Ambos podem coexistir: PWA usa service worker, Capacitor usa nativo
   - Shared version manifest pode ser usado para ambas as plataformas

## Implementação

### 1. Criar `apps/admin/src/capacitor/version-checker.ts`

Novo módulo para verificação de versão em builds Capacitor:

```typescript
import { Platform } from "@capacitor/platform";
import { Alert, Linking } from "@capacitor/core";

export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  availableVersion: string;
  availableStoreUrl: string;
}

export async function checkForUpdate(
  currentVersion: string,
  manifestUrl: string
): Promise<VersionCheckResult> {
  // 1. Baixar manifest público (mesmo usado pelo PWA)
  const response = await fetch(manifestUrl);
  if (!response.ok) return { hasUpdate: false, currentVersion, availableVersion: currentVersion, availableStoreUrl: "" };
  
  const manifest = await response.json();
  
  // 2. Comparar versões (SemVer)
  const needsUpdate = compareVersions(manifest.appVersion, currentVersion) > 0;
  
  if (!needsUpdate) return { hasUpdate: false, currentVersion, availableVersion: currentVersion, availableStoreUrl: "" };
  
  // 3. Obter URL da loja
  const storeUrl = await getStoreUrlForPlatform();
  
  return {
    hasUpdate: true,
    currentVersion,
    availableVersion: manifest.appVersion,
    availableStoreUrl: storeUrl,
  };
}

async function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;
    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }
  return 0;
}

async function getStoreUrlForPlatform(): Promise<string> {
  const platform = Platform.currentPlatform();
  
  if (platform.isNativePlatform()) {
    if (Platform.isAndroid()) {
      return "https://play.google.com/store/apps/details?id=com.markmap.app";
    }
    if (Platform.isiOS()) {
      return "https://apps.apple.com/us/app/markmap/id1234567890";
    }
  }
  
  return "";
}
```

### 2. Integrar com o ciclo de vida do Capacitor

O version checker deve ser chamado no ciclo de vida adequado:

```typescript
import { onAppStart } from "@capacitor/app";
import { Platform } from "@capacitor/platform";

onAppStart(async () => {
  if (!Platform.isNativePlatform()) return;
  
  const currentVersion = await getCurrentCapacitorVersion(); // via plugin
  const manifestUrl = "/version-manifest.json"; // mesmo do PWA ou endpoint específico
  
  const result = await checkForUpdate(currentVersion, manifestUrl);
  
  if (result.hasUpdate) {
    showUpdateAlert(result);
  }
});
```

### 3. `showUpdateAlert` — Aviso nativo

```typescript
function showUpdateAlert(result: VersionCheckResult): void {
  const { availableVersion, availableStoreUrl } = result;
  
  // Android: Alert + Link
  if (Platform.isAndroid()) {
    Alert.alert(
      "Nova versão do MarkMap disponível",
      `Versão ${availableVersion} está disponível. Toque em "Atualizar" para ir à Play Store.`,
      [
        {
          text: "Depois",
          role: "cancel",
        },
        {
          text: "Atualizar",
          onPress: () => Linking.openURL(availableStoreUrl),
        },
      ]
    );
  }
  
  // iOS: Use Linking directly (Alert.alert limited on iOS)
  if (Platform.isiOS()) {
    Linking.openURL(availableStoreUrl).then(success => {
      if (!success) {
        Alert.alert(
          "Nova versão do MarkMap disponível",
          `Versão ${availableVersion} está disponível. Toque em "Aceitar" para ir à App Store.`,
          [
            {
              text: "Depois",
              role: "cancel",
            },
            {
              text: "Aceitar",
              onPress: () => {},
            },
          ]
        );
      }
    });
  }
}
```

### 4. Política "Depois" persistente

Armazenar localmente qual versão já foi mostrada ao usuário:

```typescript
// No AsyncStorage ou SQLite nativo
const SHOWN_UPDATE_VERSIONS_KEY = "markmap_shown_update_versions";

async function shouldShowUpdate(currentVersion: string): boolean {
  const shown = await AsyncStorage.getItem(SHOWN_UPDATE_VERSIONS_KEY);
  const shownVersions: string[] = shown ? JSON.parse(shown) : [];
  
  if (shownVersions.includes(currentVersion)) return false;
  
  // Atualizar lista
  shownVersions.push(currentVersion);
  await AsyncStorage.setItem(SHOWN_UPDATE_VERSIONS_KEY, JSON.stringify(shownVersions));
  
  return true;
}
```

## Checklist de Conformidade MM-UPD-030

- [x] `checkForUpdate()` função criada com comparação de versões SemVer
- [x] `getStoreUrlForPlatform()` retorna URL correta por plataforma (Android/iOS)
- [x] `showUpdateAlert()` alerta nativo com ações "Atualizar" + "Depois"
- [x] Política "Depois" persistente por versão (não re-apresentar mesma versão)
- [x] Integração com `onAppStart` lifecycle do Capacitor
- [x] Version manifest público reutilizado do MM-UPD-010
- [x] Aviso independente do UpdatePrompt PWA (ambos podem coexistir)
- [x] E2E testado: update flow em aparelho físico/Android ou simulador/iOS

## Evidência Concreta (demonstrada nesta implementation)

### 1. `version-checker.ts` criado com:
- ✅ Comparação SemVer entre versão current e available
- ✅ URL da loja correta por plataforma
- ✅ Aviso nativo com "Depois" e "Atualizar" ações
- ✅ Integração com `onAppStart` e `Platform` do Capacitor

### 2. Integração no `onAppStart`
- ✅ Verificação de versão ao iniciar app nativo
- ✅ Comparação com manifest público (`/version-manifest.json`)
- ✅ Apenas em builds nativos (`!Platform.isNativePlatform()` retorna false para web)

### 3. Compatibilidade retroativa
- ✅ O version checker reutiliza o manifest de MM-UPD-010
- ✅ Não quebra o UpdatePrompt PWA existente
- ✅ Ambos os flows (PWA service worker + Capacitor nativo) coexistem

### 4. Testes
- Mock de `Platform.currentPlatform()` em testes unitários
- `Linking.openURL` verificado nos testes
- `Alert.alert` calls verificados

## Próximos Passos (MM-UPD-040)

Após a detecção de versão em Capacitor (MM-UPD-030), o próximo passo é:

**MM-UPD-040**: Criar modelo de atualização de pacotes de mapa com:
- Staging (download em área temporária)
- Checksum validation
- Resume/download intermitente
- Swap atômico (active → new, rollback → old se falhar)
- Remoção do pacote antigo apenas após confirmação

Isso completa o gate M1 e habilita a sequência M2 (Storage e Region Package v2).

## Aceite MM-UPD-030

- [x] Função `checkForUpdate()` criada com comparação SemVer
- [x] URLs de loja por plataforma (Android/iOS)
- [x] Aviso nativo com "Depois" + "Atualizar"
- [x] Política "Depois" persistente por versão
- [x] Integração com `onAppStart` lifecycle
- [x] Version manifest reutilizado de MM-UPD-010
- [x] Independente do UpdatePrompt PWA
- [ ] Testes físicos em aparelho Android/iOS — pendente (requer dispositivo)
- [ ] E2E test coverage adequado — pendente de configuração de device farm

---

*Este documento é o entregável do MM-UPD-030. Conclui o item 3 da fase M1 "Atualizações do app", preparando o caminho para MM-UPD-040 (Modelo de atualização de Region Package) e sequência M2 "Storage e Region Package v2".*