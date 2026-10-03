# Changelog documental

Este arquivo registra mudanças relevantes de arquitetura, documentação e organização. Não substitui tags/releases oficiais.

## 2026-10-03

### Documentação

- documentação centralizada e preenchida em `docs/`;
- README raiz reduzido a entrada objetiva;
- estado implementado separado de itens parciais/pendentes;
- adicionados documentos de arquitetura, API, banco, sync, GIS, mobile, segurança, privacidade, testes, operação e auditoria.

### Limpeza

- removido README E2E obsoleto com comandos inexistentes;
- removido workflow temporário de branch hygiene após consolidação das branches;
- materiais/configurações de agentes já haviam sido removidos em commits imediatamente anteriores.

### Correções documentais

- Hono identificado como backend real;
- Neon/PostGIS descrito como remoto de sync/backup, não fonte operacional do dispositivo;
- autenticação de usuário/RBAC não tratada como implementada sem evidência;
- storage remoto marcado como indisponível no código atual;
- gap `PATCH /features/:id` registrado.
