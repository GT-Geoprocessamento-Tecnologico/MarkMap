# Segurança

## Controles existentes

### Cliente e banco

O navegador não recebe connection string privilegiada. O fluxo esperado é app → API → banco.

### Capability de workspace

- bearer aleatório;
- servidor armazena hash;
- capability identifica autoridade para um workspace, não identidade de usuário;
- sync valida workspace via middleware.

### API

- secure headers;
- CORS allowlist sem wildcard;
- request ID;
- body limit de 1 MiB para POST/PATCH;
- validação Zod;
- logs estruturados;
- graceful shutdown.

### Dados GIS

Fks compostas e filtros por workspace ajudam a evitar cruzamento de escopo.

## Gaps conhecidos

### P0

- rate limiting/abuse protection em `/workspace/provision` e `/workspace/recover`;
- autorização workspace-scoped para storage remoto antes de habilitar presign.

### Pendente de release

- política de privacidade pública;
- revisão final de secrets/configuração;
- signing Android/iOS;
- definição do domínio/API de produção.

## Storage

As rotas `/storage/presign/*` atualmente retornam 503. Isso é mais seguro do que disponibilizar presign sem autorização adequada.

## Regras

Nunca:

- logar bearer, bootstrap proof, DATABASE_URL ou secrets;
- expor banco diretamente ao browser;
- usar wildcard CORS;
- executar migration destrutiva sem rollback e autorização;
- habilitar storage sem isolamento por workspace.
