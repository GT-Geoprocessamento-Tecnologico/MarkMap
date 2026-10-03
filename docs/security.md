# Segurança

## Controles existentes

### Cliente e banco

O navegador não recebe connection string privilegiada. O fluxo de dados remoto é app → API → banco.

### Capability de workspace

- bearer aleatório;
- servidor armazena hash;
- capability representa autoridade sobre um workspace, não identidade de usuário;
- sync e storage resolvem capability antes de acesso remoto;
- cursores e operações permanecem vinculados ao workspace.

### Rate limiting

`/workspace/provision` e `/workspace/recover` usam limiter distribuído no PostgreSQL:

- bucket por identidade técnica;
- bucket global;
- transação + advisory lock para serialização entre instâncias;
- sem confiar diretamente em `x-forwarded-for`;
- HTTP 429 / `RATE_LIMITED` quando o limite é excedido.

### Storage remoto

Quando S3 está configurado:

- presign exige capability válida;
- o objeto é prefixado por `workspaceId`;
- path traversal é recusado;
- URLs assinadas têm expiração curta.

Sem configuração S3 válida, as rotas permanecem fail-closed com 503.

### API

- secure headers;
- CORS allowlist sem wildcard;
- request ID;
- body limit para POST/PATCH;
- validação Zod;
- logs estruturados;
- graceful shutdown;
- rotas diretas `projects/layers/features` desabilitadas em production.

### Dados GIS

FKs compostas e filtros por workspace ajudam a impedir cruzamento de escopo.

## Gaps conhecidos

### Automatizáveis

- dependency/security audit em CI;
- secret scanning não destrutivo;
- Lighthouse/a11y automatizados;
- revisão de configuração para release.

### Dependentes de release/operação

- política pública de privacidade;
- signing Android/iOS;
- definição do domínio/API de produção;
- smoke contra production somente com autorização explícita.

## Regras

Nunca:

- logar bearer, bootstrap proof, DATABASE_URL ou secrets;
- expor banco diretamente ao browser;
- usar wildcard CORS;
- executar migration destrutiva sem rollback e autorização;
- habilitar acesso remoto sem isolamento por workspace;
- marcar teste físico/production como concluído com base em emulação.
