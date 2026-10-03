# Segurança

## Controles existentes

### Cliente e banco

O navegador não recebe connection string privilegiada. O fluxo remoto é app → API → banco.

### Capability de workspace

- bearer aleatório; servidor armazena hash;
- capability representa autoridade sobre um workspace, não identidade pessoal;
- sync e storage resolvem capability antes do acesso remoto;
- cursores e operações permanecem vinculados ao workspace.

### Rate limiting

`/workspace/provision` e `/workspace/recover` usam limiter distribuído no PostgreSQL com bucket por identidade técnica + global e advisory lock transacional. Não confia diretamente em `x-forwarded-for`; excesso retorna HTTP 429 / `RATE_LIMITED`.

### Storage remoto

Quando S3 está configurado, presign exige capability válida, prefixa objetos por `workspaceId`, rejeita path traversal e usa URL assinada curta. Sem configuração válida, falha fechado com 503.

### API

- secure headers;
- CORS allowlist sem wildcard;
- request ID;
- body limit;
- Zod;
- logs estruturados;
- graceful shutdown;
- rotas diretas de domínio desabilitadas em production.

### Gates automatizados

`quality-security.yml` executa:

- auditoria de dependências de produção com severidade high;
- scanner de secrets em arquivos rastreados;
- Lighthouse/acessibilidade e best-practices.

A PWA e o isolamento de sync continuam cobertos pelos workflows E2E/integração.

## Gaps restantes

### Dependentes de release/operação

- política pública de privacidade com identidade/contato/retenção definidos;
- revisão final das variáveis e origens CORS do ambiente escolhido;
- signing Android/iOS;
- domínio/API de produção;
- smoke contra production somente com autorização explícita.

## Regras

Nunca logar bearer/bootstrap proof/DATABASE_URL/secrets, expor banco diretamente ao browser, usar wildcard CORS, executar migration destrutiva sem autorização/rollback, habilitar acesso remoto sem isolamento por workspace ou inferir teste físico a partir de CI.
