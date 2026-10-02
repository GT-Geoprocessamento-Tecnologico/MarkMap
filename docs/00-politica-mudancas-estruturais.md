# Política de Mudanças Estruturais — GeoNexo

## Escopo

É mudança estrutural toda alteração que muda contratos ou persistência compartilhada, por exemplo:
- formato do IndexedDB/outbox;
- protocolo de sync;
- contratos API;
- schema/migration Postgres/PostGIS;
- CRS canônico;
- estratégia PWA/service worker;
- arquitetura mobile/Capacitor;
- autenticação/autorização;
- storage remoto/local;
- dependência central do GIS.

## Quando exige ADR

Exige ADR quando:
- substitui uma decisão arquitetural vigente;
- adiciona/remove componente central;
- muda fonte de verdade;
- altera compatibilidade entre versões instaladas;
- introduz breaking change;
- altera isolamento ou segurança;
- muda estratégia de armazenamento/sync.

Correção interna que preserva contrato não exige ADR.

## Regras

1. Auditar antes de alterar.
2. Preservar dados e compatibilidade sempre que possível.
3. Breaking change precisa de versionamento/migração.
4. Mudança de banco precisa de migration versionada e teste descartável antes de produção.
5. Mudança de IndexedDB precisa considerar upgrade de instalações existentes.
6. Mudança de sync precisa manter idempotência/retry.
7. Mudança de SW precisa preservar dados locais e atualização controlada.
8. Mudança de CRS precisa ter teste com dados reais.
9. Mudança de dependência precisa revisar licença, segurança e impacto de bundle/performance.
10. Toda mudança relevante atualiza a documentação correspondente no mesmo trabalho.

## Banco

Antes de migration remota:
- comparar schema local/remoto;
- testar migration em alvo descartável/branch temporária;
- verificar rollback/forward fix;
- obter autorização quando produção puder ser afetada;
- registrar evidência.

Sem autorização, é proibido executar DROP/TRUNCATE/DELETE destrutivo em produção.

## API e sync

Breaking change deve:
- atualizar `packages/contracts`;
- atualizar cliente/servidor;
- prever compatibilidade entre app antigo e novo quando houver instalações distribuídas;
- ter testes de retry/idempotência/conflito.

## PWA/mobile

Atualização não pode descartar:
- IndexedDB;
- outbox;
- arquivo local;
- edição ainda não persistida.

## Rollback

Toda mudança estrutural deve registrar uma das opções:
- rollback seguro;
- forward fix;
- irreversível com aprovação explícita.

## Documentos a revisar

Conforme impacto:
- ADR;
- README;
- Handoff;
- Instruções-Mestre;
- PRD;
- Checklist Mestre;
- docs de API/banco/segurança;
- THIRD_PARTY_NOTICES.
