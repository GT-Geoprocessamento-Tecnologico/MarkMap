/** @deprecated Compatibility entry point; use the canonical schemas in src/. */
export {
  featureSchema as FeatureSchema,
  featureSchema,
  createFeatureSchema,
  updateFeatureSchema,
  featurePropertiesSchema,
} from "./src/feature.js";
export type { Feature, CreateFeature, UpdateFeature } from "./src/feature.js";
export { uuidSchema as IDSchema } from "./src/project.js";
