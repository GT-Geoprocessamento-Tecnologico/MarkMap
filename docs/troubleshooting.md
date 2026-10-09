# Troubleshooting

## App não abre em desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Confirme Node 22 e porta 5173 disponível.

## Sync aparece disabled

Verifique `VITE_API_MODE`. O padrão atual é `mock`; sync remoto requer `live`.

## Sync falha

- confirme API acessível;
- confirme banco configurado;
- verifique `/health`;
- confira CORS;
- confira capability de workspace;
- não apague IndexedDB para “resolver” antes de preservar evidência/outbox.

## GPS não funciona

- confira permissão do SO;
- Android deve conter FINE e COARSE location;
- iOS deve conter `NSLocationWhenInUseUsageDescription`;
- teste físico é necessário para confirmar comportamento real.

## E2E

```bash
pnpm test:e2e
```

Ou diretamente pelo config:

```bash
pnpm exec playwright test --config=apps/admin/playwright.config.ts
```

## PostGIS

Use o workflow de integração ou banco local descartável com PostGIS. Nunca reutilize produção como banco de teste.

## iOS build

O CI usa projeto versionado + `cap sync ios`; não apague `apps/admin/ios` antes do build.

## Android build

Android é regenerado no CI. Para problemas, reproduza a mesma sequência do workflow `android-apk.yml`.

Sequência local (`apps/admin/android` é regenerável e gitignorado):

```bash
cd apps/admin
npx cap add android     # só na primeira vez
npx cap sync android
cd android && ./gradlew assembleDebug
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

**Toolchain:** o Capacitor 8 compila com `source 21`, então a JVM do Gradle precisa ser JDK 21 — com `JAVA_HOME` em JDK 17 o build falha com `invalid source release: 21`. No projeto gerado, habilite o resolvedor automático em `android/settings.gradle`:

```gradle
plugins {
    id 'org.gradle.toolchains.foojay-resolver-convention' version '1.0.0'
}
```

e aponte o Gradle para o JDK baixado em `android/gradle.properties`:

```properties
org.gradle.java.home=C:/Users/<user>/.gradle/jdks/eclipse_adoptium-21-amd64-windows.2
```
