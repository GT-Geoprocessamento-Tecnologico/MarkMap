/** @deprecated Compatibility entry point; use the canonical schemas in src/. */
export {
  uuidSchema as IDSchema,
  projectSchema as ProjectSchema,
  projectSchema,
  createProjectSchema,
  updateProjectSchema,
  timestampSchema,
} from "./src/project.js";
export type { Project, CreateProject, UpdateProject } from "./src/project.js";
export { errorResponseSchema as ErrorSchema } from "./src/errors.js";
export type { ErrorResponse as Error } from "./src/errors.js";
