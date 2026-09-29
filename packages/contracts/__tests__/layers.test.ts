import { describe, expect, it, vi } from 'vitest';
import { ErrorSchema } from '../../../packages/db/src/schema/errors';
import { createLayer } from '../../../packages/db/src/queries/layers';

describe('createLayer', () => {
  it('throws PROJECT_NOT_FOUND when project does not exist', async () => {
    // Mock the db object
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // returns empty array -> project not found
    };

    const input = {
      projectId: 'non-existent-project-id',
      name: 'Test Layer',
      kind: 'point',
      geometryType: 'Point',
    };

    await expect(createLayer(mockDb, input)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});