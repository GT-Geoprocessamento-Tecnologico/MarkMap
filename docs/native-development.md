# Desenvolvimento nativo — WebNative + Capacitor

O GeoNexo mantém **React + Vite** como núcleo e **Capacitor** como camada nativa.
O WebNative é usado como ferramenta de desenvolvimento para executar, sincronizar
e abrir os projetos Android/iOS sem criar um segundo wrapper.

## Pré-requisitos

- Node.js 22
- pnpm
- VS Code/Cursor com a extensão WebNative
- Android Studio para Android
- macOS + Xcode para iOS

O `capacitor.config.json` continua com:

```json
{
  "appId": "dev.mtsferreira.geonexo",
  "appName": "GeoNexo",
  "webDir": "dist"
}
```

## Fluxo Android

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=admin...
cd apps/admin
pnpm exec cap sync android
pnpm exec cap open android
```

No WebNative, use as ações equivalentes de **Sync**, **Run Android** ou
**Open in Android Studio**. O projeto Capacitor e os comandos acima continuam
sendo a fonte reproduzível do empacotamento.

## Fluxo iOS

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=admin...
cd apps/admin
pnpm exec cap sync ios
pnpm exec cap open ios
```

A compilação iOS requer macOS + Xcode. O workflow `iOS App` no GitHub Actions
faz a validação automatizada do projeto empacotado.

## GPS

- Web/PWA usa a Web Geolocation API.
- Android/iOS empacotados usam `@capacitor/geolocation` para solicitar a
  permissão nativa antes de o MapLibre ativar o controle de localização.
- O build Android valida `ACCESS_FINE_LOCATION` e
  `ACCESS_COARSE_LOCATION`.
- O build iOS valida `NSLocationWhenInUseUsageDescription`.

Não registrar latitude/longitude do usuário em logs de diagnóstico.
