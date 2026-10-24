# Status técnico

Baseline funcional validado em 2026-10-05: `fccda004`.

| Área | Estado | Evidência/observação |
|---|---|---|
| Lint / Typecheck / Unit | FUNCIONA | CI verde |
| Build | FUNCIONA | workflow verde |
| PostGIS Integration | FUNCIONA | banco descartável + sync/materialização |
| E2E desktop/Android | FUNCIONA | Playwright |
| E2E iOS/WebKit | FUNCIONA | Playwright |
| E2E duas instalações | FUNCIONA | reconexão real, retry, idempotência, pull e conflito |
| PWA installability/offline/upgrade | FUNCIONA | manifest/SW/offline shell/IndexedDB |
| Auto-calibração PDF | FUNCIONA | grade geográfica/UTM + confidence gate + fallback manual |
| Rate limit | FUNCIONA | PostgreSQL + advisory lock |
| Storage remoto | FUNCIONA CONDICIONAL | capability + workspace prefix; 503 sem S3 |
| Lighthouse/a11y | FUNCIONA | workflow Quality and Security verde |
| Dependency audit high | FUNCIONA | workflow verde |
| Secret scan | FUNCIONA | workflow verde |
| Cliente HTTP legado | AUDITADO | comentário obsoleto corrigido; permanece para testes/dev, enquanto produção é local-first + sync |
| Privacy policy pública | BLOQUEADO | faltam dados legais/operacionais |
| Deploy público | NÃO EXECUTADO | requer decisão/autorização |
| Testes físicos | PENDENTE EXTERNO | não inferidos de CI |

Nenhuma ação destrutiva ou alteração de production foi executada.


## Rebranding MarkMap — 2026-10-05

- site público em `apps/site`;
- identidade visual MarkMap aplicada à aplicação operacional;
- display name Web/PWA/Capacitor/iOS: MarkMap;
- identificadores nativos existentes preservados por compatibilidade;
- PR #3 integrado em `main`;
- Build, CI, PostGIS e Quality/Security ficaram verdes na primeira execução do PR antes das correções finais;
- E2E da primeira execução encontrou regressões de navegação/testes de marca e recebeu correções antes do merge;
- validação completa do HEAD pós-merge **reexecutada e passou** com runner disponível;
- nenhum deploy público ou publicação mobile executados;
- correções de ícones do menu lateral e remoção do rótulo "Offline-first" aplicadas e validadas.
