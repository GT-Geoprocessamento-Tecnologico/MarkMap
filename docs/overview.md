# Visão geral

## Objetivo

GeoNexo é uma aplicação de mapeamento e coleta de dados geoespaciais para uso em campo, inclusive sem conectividade contínua.

O princípio central é **offline-first**: a operação principal acontece no dispositivo; a nuvem é utilizada para sincronização, backup e consultas remotas.

## Usuário principal

Pessoa operando celular, tablet ou navegador em campo, podendo ficar longos períodos sem internet.

## Capacidades implementadas

- projetos, mapas, camadas e feições;
- MapLibre + Terra Draw;
- GPS;
- IndexedDB como fonte operacional local;
- outbox durável;
- sync push/pull com retry, idempotência, cursor, tombstones e conflitos explícitos;
- isolamento remoto por workspace capability;
- PostgreSQL/Neon + PostGIS;
- storage remoto workspace-scoped quando configurado;
- GeoPDF georreferenciado e auto-calibração por grade textual geográfica/UTM com limiar de confiança;
- PWA com manifest, service worker, app shell offline e upgrade de IndexedDB testado;
- Capacitor opcional para Android/iOS;
- rate limiting distribuído de provision/recover;
- gates de lint, typecheck, unit, build, E2E, PostGIS, Lighthouse/a11y, dependency audit e secret scan.

## Limites atuais

- testes físicos Android/iOS e instalação PWA real ainda precisam de evidência;
- smoke contra production depende de autorização explícita;
- política pública de privacidade depende de dados legais/operacionais não presentes no repositório;
- assinatura/publicação em lojas e deploy web público não estão autorizados/definidos;
- validação de PDF grande em aparelho físico continua pendente.

## Princípio de dados

```text
dispositivo
  IndexedDB + arquivos locais
        |
        | quando há rede
        v
      API Hono
        |
        v
PostgreSQL / Neon + PostGIS
```

O banco remoto não é pré-requisito para a atividade principal em campo.
