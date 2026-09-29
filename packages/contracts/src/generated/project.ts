import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime();

/**
 * projects.status is `varchar(32) NOT NULL DEFAULT 'active'`
 * (10-BACKEND-VISIONARIO-PRD.md:119). The PRD fixes the column width but no
 * closed set of values, so the contract guards the storage bounds only and
 * leaves the lifecycle vocabulary to the application.
 */
export const projectStatusSchema = z
  .string()
  .min(1, 'Status is required')
  .max(32, 'Status must be at most 32 characters')
  .default('active');

export const projectSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: projectStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/**
 * Only the client-owned columns: `status`, `created_at` and `updated_at` are
 * server-controlled in this phase (10-BACKEND-VISIONARIO-PRD.md:114-122).
 */
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1, 'Name is required').optional(),
    description: z.string().optional(),
  })
  .refine(
    (body) => body.name !== undefined || body.description !== undefined,
    'At least one of name or description must be provided',
  );

export type Project = z.infer<typeof projectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
