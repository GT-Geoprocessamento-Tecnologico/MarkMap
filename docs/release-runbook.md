# Runbook de release e rollback

Este documento prepara a execução; **não autoriza** deploy público, tag/release, migration em production, signing ou publicação em loja.

## 1. Preflight obrigatório

Confirmar no mesmo HEAD candidato:

- lint, typecheck, unit e build verdes;
- E2E desktop/Android, iOS/WebKit e duas instalações verdes;
- PostGIS Integration verde;
- Quality and Security verde;
- artefatos debug Android/iOS verdes quando aplicável;
- `main` sem PR/branch concorrente relevante;
- changelog e release checklist atualizados;
- política pública de privacidade aprovada;
- domínio/API/CORS de produção definidos;
- migrations revisadas separadamente;
- plano de backup/rollback confirmado.

## 2. Parâmetros que precisam de decisão humana

- versão candidata;
- provedor e domínio Web/API;
- janela de publicação;
- responsável pela aprovação;
- signing Android/iOS;
- URL da política de privacidade;
- autorização para qualquer migration remota.

Sem esses dados, parar antes de produção.

## 3. Web/PWA

Após autorização:

1. gerar build imutável do HEAD aprovado;
2. publicar Web/API no ambiente escolhido;
3. validar `/health`;
4. validar CORS somente para origens aprovadas;
5. instalar PWA em navegador suportado;
6. testar cold offline e upgrade preservando IndexedDB/outbox;
7. verificar que service worker aponta para a versão publicada.

## 4. Backend/sync

Após autorização:

1. confirmar configuração sem expor secrets;
2. não executar migration destrutiva implicitamente;
3. se houver migration, aplicar somente a versão aprovada com plano de forward-fix/rollback;
4. executar smoke com fixture descartável apenas quando autorizado;
5. verificar push/pull, idempotência e isolamento por workspace.

## 5. Mobile

Android/iOS só avançam para distribuição após signing/provisioning explícito, versão definida, política de privacidade publicada e testes físicos concluídos.

## 6. Rollback

### Código Web/API

Preferir promover novamente o último build conhecido como verde ou criar revert/forward-fix normal. Nunca usar force push/reset destrutivo.

### PWA

Rollback deve preservar compatibilidade com dados IndexedDB existentes. Não reduzir schema local sem migração compatível. Validar abertura de dados/outbox antes de promover rollback.

### Banco

Não usar DROP/TRUNCATE/DELETE como rollback improvisado. Usar migration reversível previamente revisada ou forward-fix.

## 7. Evidência final

Registrar:

- commit/versão;
- workflows e resultados;
- ambiente/domínio;
- migrations executadas (se houver);
- smoke realizado;
- artefatos publicados;
- aprovação humana;
- incidentes e rollback, se aplicável.
