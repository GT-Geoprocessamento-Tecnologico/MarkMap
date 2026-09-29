import type { Db } from '../client';
import { projects } from '../schema/projects';
import { desc } from 'drizzle-orm';

export type CreateProjectInput = {
  name: string;
  description?: string;
};

export async function createProject(db: Db, input: CreateProjectInput) {
  const result = await db.insert(projects).values(input).returning();
  return result[0];
}

export async function listProjects(db: Db, input: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const items = await db.select().from(projects).limit(limit).offset(offset).orderBy(desc(projects.createdAt));
  return { items };
}