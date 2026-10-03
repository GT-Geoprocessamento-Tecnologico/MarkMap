# Android e iOS

## Base

O app móvel reutiliza o mesmo React/Vite e usa Capacitor.

`apps/admin/capacitor.config.json`:

- appId: `dev.mtsferreira.geonexo`
- appName: `GeoNexo`
- webDir: `dist`

## Android

Workflow `android-apk.yml`:

1. instala dependências;
2. builda o web app;
3. regenera `apps/admin/android`;
4. executa `cap add android` e `cap sync android`;
5. garante permissões FINE/COARSE location;
6. gera APK debug;
7. publica artefato `geonexo-android-debug`.

Java 21 é usado no CI.

## iOS

O projeto iOS base é versionado.

Workflow `ios-app.yml`:

1. seleciona Xcode 16.x quando disponível;
2. builda o web app;
3. executa `cap sync ios`;
4. valida `NSLocationWhenInUseUsageDescription`;
5. valida CapacitorGeolocation no SwiftPM;
6. builda App.app sem code signing;
7. empacota artefato debug.

## Limites

CI comprova compilação, não comprova comportamento físico.

Pendências:

- Android físico: mapa, GPS, criar/editar, force-stop e reabrir totalmente offline;
- iOS físico equivalente;
- signing/provisioning para distribuição;
- publicação em lojas somente com autorização explícita.
