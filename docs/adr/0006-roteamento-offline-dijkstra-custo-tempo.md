# ADR-0006 — Roteamento offline com Dijkstra de custo-tempo

**Status:** Accepted

## Contexto

Roteamento precisa funcionar sem rede (aceite global #7) e sem incorporar código GPL do `openstreetmap-website` nem data files `.mwm`/`.bin` do Organic Maps. O grafo regional tem de expressar one-way, access, turn restrictions, surface e velocidades por perfil (walk/bicycle/car).

## Decisão

1. **Grafo regional próprio** (`routingGraphSchema`) com `nodes`, `edges`,
   `turnRestrictions`, `bounds`, `profileSpeeds`. Aresta carrega `oneway`,
   `access` (registro `chave → bool`), `surface`, `bridges`, `tunnels`, `name`.
2. **Dijkstra com heap binário mínimo** e **custo-tempo** (distância ÷
   velocidade), não custo-distância — favorece via rápida para carro e evita
   desvio para via proibida via velocidade efetiva.
3. **Perfis** com tabelas próprias de velocidade e de chaves de acesso:
   - `walk`: 5 km/h; chaves `foot`/`access`; ignora `oneway`; sem `motorway`;
   - `bicycle`: 15 km/h; chaves `bicycle`/`access`; sem `motorway` nem `gravel`;
   - `car`: 50 km/h default, `motorway` 110, `trunk` 90, `primary` 70,
     `secondary` 60, `tertiary` 50; chaves `motor_vehicle`/`access`.
4. **Snap** de origem/destino ao nó mais próximo antes da busca.
5. **Módulo puro, sem DOM** — roda em Web Worker, com cancelamento por
   `AbortController`.
6. **Manobras** derivadas do delta de bearing entre arestas consecutivas;
   texto TTS gerado localmente (pt-BR primeiro, mapa de mensagens por locale).

## Consequências

- nenhuma dependência de serviço de rota online;
- nenhum código GPL copiado — apenas conceitos, documentados por fonte em
  `docs/MM-MAP-600..640`;
- turn restrictions entram na expansão de vizinhos, não materializadas como
  arestas (mantém o grafo menor);
- alternativas de rota ficam fora do MVP por decisão explícita;
- custo-tempo é sensível à tabela de velocidades: ela precisa ser revisada
  junto com qualquer mudança de perfil;
- qualidade limitada pela granularidade do grafo OSM extraído no pipeline.

Relacionado: MM-MAP-600, MM-MAP-610, MM-MAP-620, MM-MAP-630, MM-MAP-640.
