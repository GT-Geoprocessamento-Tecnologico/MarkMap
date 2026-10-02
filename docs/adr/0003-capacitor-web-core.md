# ADR-0003 — Núcleo Web compartilhado empacotado com Capacitor

**Status:** Accepted  
**Data:** 2026-10-01

## Contexto

O GeoNexo precisa Web/PWA e aplicativos Android/iOS, mas já possui núcleo React/Vite/GIS funcional.

## Decisão

Manter React/Vite como núcleo compartilhado e usar Capacitor para empacotamento Android/iOS. Criar integração nativa específica apenas quando browser/WebView não atender adequadamente.

## Alternativas consideradas

- reescrever em Flutter;
- reescrever em React Native;
- aplicativos Kotlin/Swift independentes.

Foram rejeitadas neste estágio pelo custo, duplicação e perda de reutilização.

## Consequências

- Web/PWA continuam superfícies de primeira classe;
- compatibilidade de WebView deve ser testada;
- plugins/permissões mobile entram de forma incremental;
- workflows Android/iOS precisam validar o mesmo build Web.
