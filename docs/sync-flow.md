# Offline-first e sincronização

## Fonte operacional

No dispositivo, a fonte operacional é IndexedDB.

Stores atuais:

- `meta`
- `entities`
- `originals`
- `outbox`
- `conflicts`
- `acks`

## Escrita local

1. usuário cria/edita/remove dado;
2. `LocalRepository.mutate` grava a entidade local;
3. cria envelope imutável na outbox;
4. incrementa sequência local;
5. UI continua operando sem depender da rede.

## Bootstrap de workspace

O cliente gera/persiste:

- `workspaceId`;
- `installationId`;
- `bootstrapProof`.

Quando necessário, chama `/workspace/provision` e salva a capability.

## Push

`SyncEngine` lê a outbox por ordem local e envia lotes para `/sync/push`.

O servidor responde com:

- operações aceitas;
- já aplicadas;
- conflitos.

Acknowledgement durável remove o envelope da outbox.

## Pull

O cliente chama `/sync/pull` com cursor opaco.

O servidor usa sequência por workspace e devolve páginas de mudanças e tombstones. O cliente aplica a página e só então persiste o próximo cursor.

## Conflitos

Conflitos são armazenados localmente e não sobrescritos silenciosamente.

Resoluções previstas no repositório local:

- manter local;
- usar servidor.

## Segurança do cursor

O contrato define cursor no formato `v1.<payload>.<HMAC-SHA256>`, associado ao workspace/capability.

## Estados

O sync distingue:

- disabled;
- offline;
- syncing;
- synced;
- idle;
- error.

## Modo de frontend

`VITE_API_MODE` padrão é `mock`. O sync real só executa quando configurado como `live`.

Isso deve ser considerado ao validar ambiente de campo ou release.
