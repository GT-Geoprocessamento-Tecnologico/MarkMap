/** @deprecated Compatibility entry point; use the canonical schemas in src/. */
export {
  layerSchema as LayerSchema,
  layerSchema,
  createLayerSchema,
  updateLayerSchema,
  geometryTypeSchema,
} from "./src/layer.js";
export type { Layer, CreateLayer, UpdateLayer } from "./src/layer.js";
export { uuidSchema as IDSchema } from "./src/project.js";
