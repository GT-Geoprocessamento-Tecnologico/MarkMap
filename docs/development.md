# Desenvolvimento

## Branch

O repositório está consolidado em `main`. Alterações devem partir do HEAD atual e evitar duplicação de trabalho em andamento.

## Antes de alterar código

Classifique a área:

- **FUNCIONA**: preservar comportamento e adicionar apenas mudanças justificadas;
- **PARCIAL**: existe, mas faltam integrações ou validações;
- **QUEBRADO**: falha comprovada;
- **NÃO IMPLEMENTADO**: ausência comprovada.

## Comandos principais

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm format
```

## Regras de mudança

- contratos compartilhados ficam em `packages/contracts`;
- schema/migrations ficam em `packages/db`;
- nenhuma credencial de banco no navegador;
- mudanças de API devem preservar ou versionar contratos;
- conflitos de sync não podem ser silenciosamente sobrescritos;
- migrations destrutivas exigem autorização explícita;
- não afirmar teste que não foi executado.

## Banco

```bash
pnpm --filter @geonexo/db db:generate
pnpm --filter @geonexo/db db:migrate
pnpm --filter @geonexo/db db:studio
```

Migration remota deve ser revisada antes de execução.

## Documentação

Ao alterar arquitetura, endpoint, schema, sincronização, mobile ou segurança, atualize os documentos correspondentes em `docs/`.
