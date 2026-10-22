# MarkMap — decisão de rebranding

Data: 2026-10-05

## Decisão

A identidade pública do produto passa a ser **MarkMap — Planejamento Inteligente**.

## Escopo aplicado

- UI principal e dashboard;
- PWA: título, manifest e ícones;
- Capacitor: `appName=MarkMap`; o `appId` histórico é preservado para continuidade de instalação e dados locais;
- iOS: display name e texto de localização; o bundle identifier permanece estável;
- artefatos de CI mobile;
- site público em `apps/site`.

## Compatibilidade

Para não quebrar contratos e dados já estabilizados, permanecem temporariamente:

- packages internos `@markmap/*`;
- nomes históricos de recursos remotos, buckets e banco;
- caminhos internos `apps/admin`;
- identificadores nativos estáveis enquanto houver instalações compatíveis.

Esses itens são técnicos e não fazem parte da marca apresentada ao usuário.

## Ações não executadas

- deploy público;
- release/tag;
- publicação Android/iOS;
- alteração destrutiva de banco/storage;
- migração dos namespaces internos;
- nenhuma relacionada ao nome do repositório; ele já foi renomeado para `MarkMap`.

## Validação

PR #3 integrado em `main`. A validação completa do HEAD pós-merge deve ser reexecutada quando o runner do GitHub Actions estiver disponível.
