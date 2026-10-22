import { describe, it, expect } from "vitest";
import { findRoute, snapToNearestNode } from "../../src/routing/router.js";
import { generateTtsText, getDistanceText, getEtaText } from "../../src/routing/tts.js";
import type { RoutingGraph } from "@markmap/contracts";

function makeTestGraph(): RoutingGraph {
  return {
    version: "1.0.0",
    nodes: [
      { id: 0, lon: -46.63, lat: -23.55 },
      { id: 1, lon: -46.64, lat: -23.55 },
      { id: 2, lon: -46.65, lat: -23.55 },
      { id: 3, lon: -46.65, lat: -23.56 },
      { id: 4, lon: -46.63, lat: -23.56 },
    ],
    edges: [
      { id: 0, from: 0, to: 1, distance: 1000, speedKph: 50, highwayType: "residential", oneway: false, access: { yes: true }, bridges: false, tunnels: false },
      { id: 1, from: 1, to: 2, distance: 1000, speedKph: 50, highwayType: "residential", oneway: false, access: { yes: true }, bridges: false, tunnels: false },
      { id: 2, from: 2, to: 3, distance: 1100, speedKph: 50, highwayType: "residential", oneway: false, access: { yes: true }, bridges: false, tunnels: false },
      { id: 3, from: 3, to: 4, distance: 2000, speedKph: 50, highwayType: "residential", oneway: false, access: { yes: true }, bridges: false, tunnels: false },
      { id: 4, from: 4, to: 0, distance: 1100, speedKph: 50, highwayType: "residential", oneway: false, access: { yes: true }, bridges: false, tunnels: false },
      { id: 5, from: 0, to: 4, distance: 500, speedKph: 50, highwayType: "residential", oneway: false, access: { yes: true }, bridges: false, tunnels: false },
    ],
    turnRestrictions: [],
    bounds: [-46.65, -23.56, -46.63, -23.55],
    osmDataDate: "2024-01-15T00:00:00Z",
    profiles: ["walk", "bicycle", "car"],
  };
}

describe("snapToNearestNode", () => {
  it("finds nearest node", () => {
    const graph = makeTestGraph();
    const nodeId = snapToNearestNode(graph, -46.63, -23.55);
    expect(nodeId).toBe(0);
  });

  it("finds nearest node for different point", () => {
    const graph = makeTestGraph();
    const nodeId = snapToNearestNode(graph, -46.65, -23.56);
    expect(nodeId).toBe(3);
  });
});

describe("findRoute", () => {
  it("finds a route between connected nodes", () => {
    const graph = makeTestGraph();
    const route = findRoute(graph, {
      origin: [-46.63, -23.55],
      destination: [-46.65, -23.56],
      profile: "car",
    });
    expect(route).not.toBeNull();
    expect(route!.distance).toBeGreaterThan(0);
    expect(route!.duration).toBeGreaterThan(0);
    expect(route!.steps.length).toBeGreaterThan(0);
    expect(route!.geometry.length).toBeGreaterThan(0);
  });

  it("returns null for disconnected graph", () => {
    const graph = makeTestGraph();
    graph.edges = [];
    const route = findRoute(graph, {
      origin: [-46.63, -23.55],
      destination: [-46.65, -23.56],
      profile: "car",
    });
    expect(route).toBeNull();
  });

  it("respects profile restrictions", () => {
    const graph = makeTestGraph();
    graph.edges[0]!.access = { motor_vehicle: false, access: false };
    graph.edges[4]!.access = { motor_vehicle: false, access: false };
    graph.edges[5]!.access = { motor_vehicle: false, access: false };
    const route = findRoute(graph, {
      origin: [-46.63, -23.55],
      destination: [-46.64, -23.55],
      profile: "car",
    });
    expect(route).toBeNull();
  });
});

describe("generateTtsText", () => {
  const step = {
    maneuver: {
      type: "turn_left" as const,
      location: [0, 0] as [number, number],
      distance: 100,
      duration: 10,
      roadName: "Rua Augusta",
    },
    distance: 100,
    duration: 10,
    geometry: [[0, 0]] as [number, number][],
  };

  it("generates Portuguese text", () => {
    expect(generateTtsText(step, "pt-BR")).toContain("esquerda");
    expect(generateTtsText(step, "pt-BR")).toContain("Rua Augusta");
  });

  it("generates English text", () => {
    expect(generateTtsText(step, "en")).toContain("left");
  });
});

describe("getDistanceText", () => {
  it("formats meters", () => {
    expect(getDistanceText(500, "pt-BR")).toContain("metros");
  });

  it("formats kilometers", () => {
    expect(getDistanceText(1500, "pt-BR")).toContain("quilômetros");
  });
});

describe("getEtaText", () => {
  it("formats minutes", () => {
    expect(getEtaText(300, "pt-BR")).toContain("min");
  });

  it("formats hours and minutes", () => {
    expect(getEtaText(3600, "pt-BR")).toContain("h");
  });
});
