# Documentação do GeoNexo

Esta pasta é a fonte documental do repositório. Os documentos descrevem o **estado comprovado no código**, separando funcionalidades implementadas de itens parciais ou pendentes.

## Índice

| Documento | Conteúdo |
|---|---|
| [overview.md](overview.md) | Produto, objetivos, capacidades e limites atuais |
| [architecture.md](architecture.md) | Arquitetura e fluxo de dados |
| [repository-structure.md](repository-structure.md) | Organização do monorepo |
| [setup.md](setup.md) | Requisitos, instalação e variáveis de ambiente |
| [development.md](development.md) | Fluxo de desenvolvimento e regras de mudança |
| [testing.md](testing.md) | Estratégia de testes e CI |
| [api-reference.md](api-reference.md) | Rotas Hono e comportamento atual |
| [data-model.md](data-model.md) | PostgreSQL/PostGIS e entidades de sync |
| [sync-flow.md](sync-flow.md) | IndexedDB, outbox, push/pull e conflitos |
| [gis-geopdf.md](gis-geopdf.md) | GIS, CRS e GeoPDF |
| [mobile.md](mobile.md) | Capacitor, Android e iOS |
| [security.md](security.md) | Controles existentes e gaps conhecidos |
| [privacy.md](privacy.md) | Requisitos de privacidade ainda pendentes de política pública |
| [deployment.md](deployment.md) | Build, artefatos e distribuição |
| [operations.md](operations.md) | Operação, observabilidade e rollback |
| [user-guide.md](user-guide.md) | Uso funcional do aplicativo |
| [troubleshooting.md](troubleshooting.md) | Diagnóstico de problemas |
| [status.md](status.md) | Matriz FUNCIONA/PARCIAL/QUEBRADO/NÃO IMPLEMENTADO |
| [repository-audit.md](repository-audit.md) | Auditoria e limpeza do repositório |
| [handoff.md](handoff.md) | Continuidade e próximo passo operacional |
| [contributing.md](contributing.md) | Regras de contribuição/manutenção |
| [release-checklist.md](release-checklist.md) | Gates de release |
| [glossary.md](glossary.md) | Termos do domínio |
| [adr/README.md](adr/README.md) | Decisões arquiteturais |
| [legal.md](legal.md) | Índice de licenças e terceiros |
| [changelog.md](changelog.md) | Mudanças relevantes documentadas |

## Fonte de verdade

Em caso de divergência, prevalecem nesta ordem:

1. código/configuração no HEAD atual;
2. contratos e migrations versionados;
3. evidência de CI/testes;
4. documentação desta pasta;
5. hipóteses e itens planejados.

Documentação deve ser atualizada junto com mudanças relevantes de arquitetura, APIs, banco, mobile, segurança ou fluxo offline.
