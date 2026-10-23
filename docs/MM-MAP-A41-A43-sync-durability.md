# MarkMap A41–A43 — sync resiliente e regressões determinísticas

## Objetivo e contexto

Continuar do HEAD `dev/markmap-pwa-v2@16906cd` verificado junto ao Checklist Mestre do Notion (2026-10-12). Preservar React/Vite, offline-first IndexedDB/outbox e contratos da API.

## Auditoria antes do patch

- **FUNCIONA:** push/pull A37–A40, cursor incremental, conflitos explícitos, recuperação 401.
- **QUEBRADO:** prazo HTTP termina após headers, permitindo body indefinido travar syncNow; ACK retornando false/undefined é contado como enviada.
- **PARCIAL:** testes A34 usam atrasos fixos 20–35 ms e falham ocasionalmente sob execução paralela.
- **NÃO IMPLEMENTADO:** homologação real de navegador/aparelhos, bloqueio exclusivo de release.

## Escopo, arquivos, fora do escopo

- A41: `apps/admin/src/lib/sync/sync-engine.ts`: manter AbortController válido até leitura+parse do body; erro HTTP não depende de parse de body; manter recovery 401.
- A42: só contar ACK com resultado durável `true`. Mock de Vitest alinhado à assinatura real.
- A43: remover sleeps fixos de `scripts/region-generation-consumers.test.mjs` e `scripts/region-revision-ui.test.mjs`; observar resultado assíncrono real.
- Novo teste: `scripts/sync-request-durability.test.mjs` (8 casos).
- Fora: alterar banco/Neon, esquema IndexedDB, rede no modo offline, UI, API ou contratos.

## Segurança e aceite

- Um body HTTP que nunca conclui causa status erro e permite novo sync; 401 tem retry com bearer renovado sem esperar body inválido.
- ACK recusada não contabiliza push nem remove operação local.
- Worker e React com esperas por condição suportam carga paralela sem falso negativo.
- Sem segredo/token/URL na interface; sem descarte silencioso de operações.

## Testes e QA (sem GitHub CI)

- **Reprodução:** 4 falhas em 7 testes novos contra a versão anterior.
- **Após patch:** Node v22.16.0 `node --test scripts/*.test.mjs`: 197/197 PASS em **três rodadas**; `tsc -p tsconfig.qa.json` estrito, com declarações stub isoladas: PASS; `node --check` PASS.
- Limitações: monorepo completo não disponível para full lint/build/Vitest/Playwright, nem hardware Android/iOS, IndexedDB/MapLibre reais. Não homologar release.

## Git, riscos e rollback

Trabalhar exclusivamente em `dev/markmap-pwa-v2`; commits `[skip ci]`; sem GitHub Actions, merge main, deploy Vercel, Neon/migrations, force push, secrets, tags, lojas ou exclusões. Risco: servidor que entrega body parcial será interrompido mais cedo em vez de prender a sincronização. Rollback pontual por revert dos commits, sem migration.

## Relatório esperado

Registrar SHA, testes realmente executados, pendências não bloqueantes de desenvolvimento e gate RC ainda fechado no Handoff e Checklist Mestre.
