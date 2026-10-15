// Contrato de regressão aprovado fisicamente pelo responsável em Android/iOS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("o GeoPDF preserva a janela, os quatro cantos e a sobreposição", () => {
  const raster = read("apps/admin/src/lib/pdf/geopdf-overlay.ts");
  const map = read("apps/admin/src/pages/workspace/CommandCenterPage.tsx");
  assert.match(raster, /georeferencedRasterWindow\(reference,/);
  assert.match(raster, /pageToLonLat\(reference,\s*\[pageX, pageY\]\)/);
  assert.match(map, /type: "image", url: geoPdfOverlay\.url/);
  assert.match(map, /coordinates: geoPdfOverlay\.coordinates/);
  assert.match(map, /map\.fitBounds\(\[/);
});

test("botões GPS continuam acessíveis e precisão vem do dispositivo", () => {
  const map = read("apps/admin/src/pages/workspace/CommandCenterPage.tsx");
  const lib = read("packages/maps/src/maplibre.ts");
  assert.match(lib, /enableHighAccuracy: true/);
  assert.match(lib, /map\.addControl\(locationControl, 'top-right'\)/);
  assert.match(map, /locationControlRef\.current = geolocate/);
  assert.match(map, /geolocate\.on\("geolocate"/);
  assert.match(map, /label="Minha localização"/);
  assert.doesNotMatch(map, /map\.removeControl\(geolocate\)/);
});

test("cobertura de interface inclui mapa-base e GPS no Android e iOS", () => {
  const spec = read("apps/admin/e2e/gps-geopdf-alignment.spec.ts");
  const config = read("apps/admin/playwright.config.ts");
  assert.match(spec, /an online GeoPDF opens over the real surrounding basemap/);
  assert.match(spec, /maplibregl-ctrl-geolocate/);
  assert.match(config, /name: "pixel-7"/);
  assert.match(config, /name: "iphone-13"/);
});
