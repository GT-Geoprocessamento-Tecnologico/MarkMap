import { db } from './client';
import { projects } from './schema/projects';
import { z } from 'zod';
import { ErrorSchema } from '../schema/errors';
import { IDSchema } from '../schema/project';
import { and, desc, eq } from 'drizzle-orm';

// Zod schema for the return type of createProject
export const CreateProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters' }),
  description: z.string().max(500, { message: 'Description too long' }).optional(),
});

export const UpdateProjectSchema = z.object({
  id: IDSchema,
  name: z.string().min(3, { message: 'Project name must be at least 3 characters' }).optional(),
  description: z.string().max(500, { message: 'Description too long' }).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>['output'];
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>['output'];

/**
 * Create a new project with the given name and description.
 */
export async function createProject(input: CreateProjectInput) {
  const result = await db.insert(projects).values(input).returning();
  return result[0];
}

/**
 * Get a project by its ID.
 * @throws {ErrorSchema} if the project does not exist.
 */
export async function getProject(id: string) {
  const result = await db.select().from(projects).where(eq(projects.id, id));
  if (result.length === 0) {
    // Return a typed error object that matches our global error contract
    const error = new ErrorSchema({
      code: 'PROJECT_NOT_FOUND',
      message: `Project with id ${id} not found`,
      requestId: crypto.randomUUID(),
    });
    // Node's `throw` with a plain object may be caught by higher‑level middleware.
    // Zod validation in request pipelines can interpret this.
    throw error;
  }
  return result[0];
}

/**
 * List projects with pagination.
 */
export async function listProjects(input: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  return await db.select().from(projects).limit(limit).offset(offset);
}

/**
 * Update a project by its ID.
 * Returns the updated record, or throws a `PROJECT_NOT_FOUND` error if it does not exist.
 */
export async function updateProject(input: UpdateProjectInput) {
  const { id, ...rest } = input;
  const result = await db
    .update(projects)
    .set(rest)
    .where(eq(projects.id, id))
    .returning();

  if (result.length === 0) {
    const error = new ErrorSchema({
      code: 'PROJECT_NOT_FOUND',
      message: `Project with id ${id} not found`,
      requestId: crypto.randomUUID(),
    });
    throw error;
  }
  return result[0];
}