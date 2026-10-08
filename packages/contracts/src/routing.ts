import { z } from "zod";

export const routingProfileSchema = z.enum(["walk", "bicycle", "car"]);
export type RoutingProfile = z.infer<typeof routingProfileSchema>;

export const graphNodeSchema = z.object({
  id: z.number().int().nonnegative(),
  lon: z.number(),
  lat: z.number(),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeSchema = z.object({
  id: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  distance: z.number().positive(),
  speedKph: z.number().positive(),
  name: z.string().optional(),
  highwayType: z.string(),
  surface: z.string().optional(),
  oneway: z.boolean(),
  access: z.record(z.string(), z.boolean()),
  bridges: z.boolean().default(false),
  tunnels: z.boolean().default(false),
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const turnRestrictionSchema = z.object({
  fromEdge: z.number().int().nonnegative(),
  viaNode: z.number().int().nonnegative(),
  toEdge: z.number().int().nonnegative(),
  type: z.enum([
    "no_left_turn",
    "no_right_turn",
    "no_straight_on",
    "only_left_turn",
    "only_right_turn",
    "only_straight_on",
  ]),
});

export type TurnRestriction = z.infer<typeof turnRestrictionSchema>;

export const routingGraphSchema = z.object({
  version: z.string(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  turnRestrictions: z.array(turnRestrictionSchema),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  osmDataDate: z.string().datetime(),
  profiles: z.array(routingProfileSchema),
});

export type RoutingGraph = z.infer<typeof routingGraphSchema>;

export const maneuverSchema = z.object({
  type: z.enum([
    "depart",
    "turn_left",
    "turn_right",
    "continue",
    "roundabout",
    "roundabout_exit",
    "merge",
    "fork_left",
    "fork_right",
    "u_turn",
    "arrive",
    "new_name",
  ]),
  location: z.tuple([z.number(), z.number()]),
  distance: z.number().min(0),
  duration: z.number().min(0),
  roadName: z.string().optional(),
  exitNumber: z.number().optional(),
  modifier: z
    .enum([
      "left",
      "right",
      "sharp_left",
      "sharp_right",
      "slight_left",
      "slight_right",
      "uturn",
    ])
    .optional(),
});

export type Maneuver = z.infer<typeof maneuverSchema>;

export const routeStepSchema = z.object({
  maneuver: maneuverSchema,
  distance: z.number().min(0),
  duration: z.number().min(0),
  geometry: z.array(z.tuple([z.number(), z.number()])),
});

export type RouteStep = z.infer<typeof routeStepSchema>;

export const routeSchema = z.object({
  profile: routingProfileSchema,
  distance: z.number().min(0),
  duration: z.number().min(0),
  steps: z.array(routeStepSchema),
  geometry: z.array(z.tuple([z.number(), z.number()])),
  legs: z.array(
    z.object({
      distance: z.number().min(0),
      duration: z.number().min(0),
      summary: z.string(),
    }),
  ),
  origin: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
});

export type Route = z.infer<typeof routeSchema>;

export const routeRequestSchema = z.object({
  origin: z.tuple([z.number(), z.number()]),
  destination: z.tuple([z.number(), z.number()]),
  profile: routingProfileSchema,
  alternatives: z.boolean().optional(),
});

export type RouteRequest = z.infer<typeof routeRequestSchema>;
