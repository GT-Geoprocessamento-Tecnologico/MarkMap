# Documentação do MarkMap

Esta pasta é a fonte documental do repositório e separa estado comprovado de pendências externas.

## Índice

| Documento | Conteúdo |
|---|---|
| [site-app-boundaries.md](site-app-boundaries.md) | Contrato permanente: origens separadas, instalação PWA, autoria e versão |
| [overview.md](overview.md) | Produto, capacidades e limites |
| [architecture.md](architecture.md) | Arquitetura e fluxo de dados |
| [repository-structure.md](repository-structure.md) | Organização do monorepo |
| [setup.md](setup.md) | Instalação e variáveis |
| [development.md](development.md) | Desenvolvimento |
| [testing.md](testing.md) | Testes e CI |
| [api-reference.md](api-reference.md) | API Hono |
| [data-model.md](data-model.md) | PostgreSQL/PostGIS |
| [sync-flow.md](sync-flow.md) | IndexedDB/outbox/sync |
| [gis-geopdf.md](gis-geopdf.md) | GIS, CRS e GeoPDF |
| [mobile.md](mobile.md) | Android/iOS |
| [security.md](security.md) | Segurança |
| [privacy.md](privacy.md) | Privacidade e insumos faltantes |
| [deployment.md](deployment.md) | Build e distribuição |
| [release-runbook.md](release-runbook.md) | Preflight, publicação autorizada e rollback |
| [operations.md](operations.md) | Operação e observabilidade |
| [user-guide.md](user-guide.md) | Guia de uso |
| [troubleshooting.md](troubleshooting.md) | Diagnóstico |
| [status.md](status.md) | Matriz de estado |
| [repository-audit.md](repository-audit.md) | Auditoria do repositório |
| [master-checklist.md](master-checklist.md) | Checklist Mestre operacional espelhado do Notion |
| [handoff.md](handoff.md) | Continuidade |
| [release-checklist.md](release-checklist.md) | Gates de release |
| [legal.md](legal.md) | Licenças/terceiros |
| [changelog.md](changelog.md) | Mudanças relevantes |
| [adr/README.md](adr/README.md) | ADRs |

## Fonte de verdade

1. código/configuração no HEAD;
2. contratos/migrations;
3. evidência de CI/testes;
4. documentação;
5. hipóteses.

## Sincronização operacional

O Checklist Mestre existe em dois locais:

- Notion: visão operacional colaborativa;
- `docs/master-checklist.md`: espelho versionado no Git.

Mudanças relevantes de fase, arquitetura, bloqueio, evidência ou próximo passo devem atualizar **Notion + `docs/master-checklist.md` + `docs/handoff.md` na mesma execução**. Nenhum item deve ser marcado como concluído sem evidência.

## Marca e distribuição

A identidade pública vigente é **MarkMap — Planejamento Inteligente**. O site público vive em `apps/site`; a aplicação operacional permanece em `apps/admin` para preservar os pipelines existentes.
