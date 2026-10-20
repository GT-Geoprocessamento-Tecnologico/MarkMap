# Versões do MarkMap

Fonte da versão do aplicativo: `apps/admin/package.json`. Todos os agentes seguem [a política de versionamento](docs/versioning.md). O [histórico documental anterior](docs/changelog.md) permanece preservado.

## [0.3.0] - 2026-10-20

### Alterações

- Identifica o conjunto de melhorias de mapas que vinha sendo publicado como `0.2.0-dev.0`: altitude real online e offline, perfil do traçado, busca local por nomes e catálogo com 55 mapas.
- Estabelece regra obrigatória de incremento numérico para qualquer agente, com uma versão reservada por entrega e changelog correspondente.
- Bloqueia builds de produção com versão reutilizada por outro commit e verifica a concordância entre pacote e `version.json` gerado.
- Mantém os protocolos, schemas locais, dados existentes e pisos de compatibilidade dos mapas.

### Validação

- `node --test scripts/version-release-guard.test.mjs`: 11 testes aprovados, incluindo versão repetida, sufixo sem incremento numérico, leitura travada da baseline e divergência de artefatos.
- Candidato `0.3.0`: 243 testes da aplicação e 29 verificações Node aprovados; TypeScript, ESLint (sem erros, com cinco avisos já existentes), build Vite e conferência de `version.json` aprovados.
- A validação anterior do conjunto de mapas em `6adc5021` confirmou busca e altitude online/offline no domínio oficial e preservação de 20 arquivos na instalação Windows. A publicação desta versão exige nova confirmação da versão e do commit no domínio oficial e na interface instalada.
