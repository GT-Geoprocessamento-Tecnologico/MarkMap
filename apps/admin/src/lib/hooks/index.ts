/**
 * Hooks de dados para as paginas do admin (read-only para page-agents):
 * importe daqui (`@/lib/hooks`) e nao monte queries/mutacoes na mao.
 */
export { useProjects, useProject, useCreateProject } from "./projects";
export { useProjectLayers, useLayer, useCreateLayer } from "./layers";
export {
  useFeatures,
  useCreateFeature,
  useUpdateFeature,
  useDeleteFeature,
} from "./features";
export type { UpdateFeatureVariables } from "./features";
