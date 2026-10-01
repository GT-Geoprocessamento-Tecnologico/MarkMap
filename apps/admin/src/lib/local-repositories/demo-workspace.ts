import { syncEntityPayloadSchema } from "@geonexo/contracts";

import { getDb } from "../mock/storage";
import { localRepository } from "./index";

const BOOTSTRAP_META_KEY = "demoWorkspaceMaterialized";

let materializing: Promise<void> | null = null;

/**
 * `mock` e o backend de demonstracao (`src/lib/mock`), mas o app so le do
 * repositorio local: sem materializar o seed uma vez por workspace, projetos,
 * camadas e feicoes do backend de demonstracao nunca chegam ao mapa.
 */
export function ensureDemoWorkspace(): Promise<void> {
  materializing ??= materialize();
  return materializing;
}

async function materialize(): Promise<void> {
  if ((import.meta.env.VITE_API_MODE ?? "mock") !== "mock") return;
  try {
    if (await localRepository.getMeta<boolean>(BOOTSTRAP_META_KEY)) return;
    const demo = getDb();
    const workspaceEmpty =
      (await localRepository.listEntities("project")).length === 0;
    if (workspaceEmpty && demo.projects.length > 0) {
      const groups = [
        ["project", demo.projects],
        ["layer", demo.layers],
        ["feature", demo.features],
      ] as const;
      for (const [entity, rows] of groups)
        for (const row of rows)
          await localRepository.mutate({
            entity,
            entityId: row.id,
            operation: "upsert",
            baseVersion: null,
            payload: syncEntityPayloadSchema.parse({ entity, data: row }),
          });
    }
    await localRepository.setMeta(BOOTSTRAP_META_KEY, true);
  } catch {
    // Melhor esforco: a leitura local nunca pode depender do seed de demonstracao.
  }
}
