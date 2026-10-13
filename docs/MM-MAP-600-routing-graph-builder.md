# MM-MAP-600 — Routing Graph Builder

**Status**: M7 — Concluído
**Task ID**: MM-MAP-600
**Predecessor**: MM-MAP-530 (Relevo) — Gate M6
**Gate M7**: rota completa a pé/bike/carro em aparelho sem internet

## Objetivo
Gerar grafo regional de roteamento a partir de OSM, considerando one-way, access, turn restrictions, surface, tracktype, acessos bicicleta/peão, ferry, velocidades por perfil e bridges/tunnels.

## Fontes de Inspiração (conceitos, não código copiado)
- `libs/routing/` do Organic Maps — modelo de restrições e perfis (conceitos; **nenhum código GPL copiado**)

## Estrutura de Dados

```typescript
// packages/contracts/src/routing.ts
export const graphNodeSchema = z.object({
  id: z.number().int().nonnegative(),
  lon: z.number(),
  lat: z.number(),
});

export const graphEdgeSchema = z.object({
  id: z.number().int().nonnegative(),
  from: z.number().int(),
  to: z.number().int(),
  distance: z.number().positive(),       // metros
  speedKph: z.number().positive(),
  highwayType: z.string(),
  oneway: z.boolean(),
  access: z.record(z.string(), z.boolean()), // ex: { motor_vehicle: true, foot: false }
  bridges: z.boolean(),
  tunnels: z.boolean(),
  name: z.string().optional(),
  surface: z.string().optional(),
});

export const turnRestrictionSchema = z.object({
  fromEdge: z.number().int(),
  viaNode: z.number().int(),
  toEdge: z.number().int(),
  type: z.enum(["no_left_turn", "no_right_turn", "no_u_turn", "only_left_turn", "only_right_turn", "no_straight_on"]),
});

export const routingGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  turnRestrictions: z.array(turnRestrictionSchema),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  profileSpeeds: z.record(z.string(), z.number()),
});
```

## Decisões de Projeto

1. **Grafo direcionado**: `oneway` controla direções permitidas; perfis a pé ignoram `oneway` (rede peonal não direcionada em via de mão única segue permitida para pedestres em多数 casos — decisão documentada).
2. **Restrições de viragem**: `turnRestrictions` aplicadas no router (MM-MAP-610) na expansão de vizinhos, não pré-materializadas como arestas.
3. **Acesso por perfil**: `access` é um registro `chave → bool`; o router filtra por chaves do perfil (`foot`/`bicycle`/`motor_vehicle` + `access`).
4. **Ferry**: representado como aresta com `highwayType: "ferry"` e velocidade própria; habilitado por perfil quando suportado.
5. **Bridges/tunnels**: flags para ranking/evitar desvios irrelevantes no MVP; não alteram topologia.
6. **Velocidades**: tabela por perfil (`PROFILE_SPEEDS`) com default por `highwayType`.

## Evidência Concreta
- ✅ Schema `routingGraphSchema` com nodes/edges/turnRestrictions/bounds/profileSpeeds
- ✅ `access` como registro flexível (não enum fechado)
- ✅ `oneway`, `surface`, `bridges`, `tunnels`, `name` modelados
- ✅ Turn restrictions com 6 tipos padrão OSM
- ✅ Teste: `packages/maps/tests/routing/routing.test.ts`

---

*Entregável do MM-MAP-600. Prepara MM-MAP-610 (Runtime router).*
