# Visão geral

## Objetivo

GeoNexo é uma aplicação de mapeamento e coleta de dados geoespaciais para uso em campo, inclusive sem conectividade contínua.

O princípio central é **offline-first**: a operação principal acontece no dispositivo; a nuvem é utilizada para sincronização, backup e consultas remotas.

## Usuário principal

Pessoa operando celular, tablet ou navegador em campo, podendo ficar longos períodos sem internet.

## Capacidades implementadas

- projetos e camadas;
- visualização cartográfica com MapLibre;
- desenho e edição vetorial com Terra Draw;
- GPS;
- armazenamento local em IndexedDB;
- fila durável de operações (outbox);
- sincronização push/pull;
- versionamento, idempotência, cursor incremental e tombstones;
- conflitos explícitos;
- PostgreSQL/Neon com PostGIS;
- importação e processamento GIS/GeoPDF;
- PWA;
- empacotamento Android/iOS com Capacitor.

## Limites atuais

- testes físicos finais Android/iOS ainda precisam de evidência;
- fluxo real entre duas instalações ainda precisa de validação;
- storage remoto possui rotas de presign, mas responde indisponível no estado atual;
- rate limiting em provision/recover de workspace ainda é pendente;
- política pública de privacidade ainda precisa ser definida;
- assinatura/publicação em lojas e deploy web de produção não estão concluídos;
- calibração automática de PDF sem georreferenciamento válido permanece pendente.

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
