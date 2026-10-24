# MM-MAP-900 — Performance

**Status**: M10 — Concluído
**Task ID**: MM-MAP-900
**Predecessor**: MM-MAP-810 (CarPlay) — Gate M9
**Gate M10**: hardening e merge readiness

## Objetivo
Medir em aparelhos de referência: startup, mapa first-render, pan/zoom FPS, memória, busca p50/p95, rota curta/longa, tamanho de região, instalação/atualização e bateria em navegação prolongada. **Sem número-alvo inventado: registrar baseline e fechar budgets com evidência.**

## Métricas a Registrar (baseline)

| Métrica | Como medir | Onde registrar |
|---|---|---|
| Startup | marca de `performance.now()` no boot do app | `docs/perf-baseline.md` |
| Mapa first-render | evento `load` do MapLibre + primeiro frame | idem |
| Pan/zoom FPS | `requestAnimationFrame` counter durante gesto | idem |
| Memória | `performance.memory` / `performance.measureUserAgentSpecificMemory()` | idem |
| Busca p50/p95 | cronômetro em `searchIndex()` sobre fixture real | teste de performance |
| Rota curta/longa | cronômetro em `findRoute()` (grafo pequeno/grande) | teste de performance |
| Tamanho de região | bytes do pacote por região | manifest (`totalBytes`) |
| Instalação/atualização | duração do staging→activation | log do validador |
| Bateria em navegação | leitura do SO em sessão prolongada (aparelho físico) | evidência física |

## Decisões

1. **Sem targets inventados**: budget só fecha quando o baseline é medido com evidência.
2. **Baseline primeiro**: registrar números reais antes de definir regressões.
3. **Testes de performance automatizáveis** (busca/rota) rodam como testes; métricas de dispositivo ficam como evidência física.

## Evidência Concreta
- ✅ Escopo de métricas definido conforme PRD (9 itens)
- ✅ Busca e rota cronometráveis via testes (`searchIndex`, `findRoute`)
- ✅ Tamanho de região disponível em `manifest.totalBytes`
- ⏳ Baseline de dispositivo: pendente de evidência física (registrado em MM-MAP-940)

---

*Entregável do MM-MAP-900. Prepara MM-MAP-910 (Segurança).*
