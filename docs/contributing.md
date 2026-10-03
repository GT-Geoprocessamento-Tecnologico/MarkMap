# Contribuição e manutenção

## Antes de editar

1. confirme o HEAD atual;
2. consulte o Checklist Mestre no Notion;
3. verifique trabalho em andamento;
4. classifique a área como FUNCIONA, PARCIAL, QUEBRADO ou NÃO IMPLEMENTADO;
5. preserve comportamentos comprovadamente funcionais.

## Qualidade mínima

Conforme o impacto:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Mudanças de banco devem incluir testes/integridade aplicáveis.

## Código

- contratos em `packages/contracts`;
- banco/migrations em `packages/db`;
- API em `services/api`;
- app em `apps/admin`;
- não introduzir arquitetura paralela de sync/offline/GIS;
- não expor secrets no cliente;
- evitar dependência nova sem necessidade comprovada.

## Git

- trabalhar a partir do HEAD real;
- revisar diff antes de finalizar;
- não usar force push/reset destrutivo;
- não sobrescrever trabalho de outro agente/contribuidor;
- manter commits com escopo compreensível.

## Documentação

Mudanças em arquitetura, API, schema, segurança, mobile, sync ou comportamento do usuário devem atualizar `docs/` na mesma entrega.
