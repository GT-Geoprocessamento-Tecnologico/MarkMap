# MarkMap — decisão de rebranding

Data: 2026-10-05

## Decisão

A identidade pública do produto passa a ser **MarkMap — Planejamento Inteligente**.

## Escopo aplicado

- UI principal e dashboard;
- PWA: título, manifest e ícones;
- Capacitor: `appName=MarkMap` e `appId=dev.mtsferreira.markmap`;
- iOS: display name, bundle identifier e texto de localização;
- artefatos de CI mobile;
- site público em `apps/site`.

## Compatibilidade

Para não quebrar contratos e dados já estabilizados, permanecem temporariamente:

- packages internos `@geonexo/*`;
- nomes históricos de recursos remotos, buckets e banco;
- caminhos internos `apps/admin`.

Esses itens são técnicos e não fazem parte da marca apresentada ao usuário.

## Ações não executadas

- deploy público;
- release/tag;
- publicação Android/iOS;
- alteração destrutiva de banco/storage;
- migração dos namespaces internos;
- renomeação administrativa do repositório GitHub.

## Validação

Mudança submetida ao PR #3 para execução dos gates antes da integração em `main`.
