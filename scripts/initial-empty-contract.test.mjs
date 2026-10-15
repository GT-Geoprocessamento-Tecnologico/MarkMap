// Instalações novas vazias. Nunca limpar dados locais já persistidos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("dados fictícios não são inicializados no IndexedDB ou mock de execução", () => {
  const storage = read("apps/admin/src/lib/mock/storage.ts");
  assert.match(storage, /persist\(\{ version: MOCK_DB_VERSION, projects: \[\], layers: \[\], features: \[\] \}\)/);
  assert.doesNotMatch(storage, /persist\(createSeedDb\(\)\)/);
  assert.doesNotMatch(read("apps/admin/src/lib/local-repositories/demo-workspace.ts"), /localRepository\.mutate\(/);
});

test("sistemas CRS da interface começam vazios; sistemas salvos persistem", () => {
  const file = read("apps/admin/src/pages/dashboard/CoordinateSystemsPage.tsx");
  assert.match(file, /const DEFAULT_SYSTEMS: CrsEntry\[\] = \[\];/);
  assert.match(file, /localStorage\.getItem\(STORAGE_KEY_SYSTEMS\)/);
  assert.match(file, /saveSystems\(updated\)/);
});

test("Análises nunca carrega camadas mock e mostra estado vazio corretamente", () => {
  const file = read("apps/admin/src/pages/dashboard/AnalyticsPage.tsx");
  assert.match(file, /localRepository\.listEntities\("layer"\)/);
  assert.doesNotMatch(file, /import \{ listProjectLayers \} from/);
  assert.match(file, /ids\.length > 0 && layers\.isLoading/);
});
