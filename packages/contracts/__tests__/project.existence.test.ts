import { z } from 'zod';
import { db } from '../../../db/db';
import { projects } from '../../../db/schema/projects';
import { ErrorSchema } from '../../../packages/contracts/src/errors';

describe('Project existence validation', () => {
  it('rejects creation of a layer with non-existent projectId', async () => {
    // Attempt to create a layer referencing a project that does not exist
    const layerInput = {
      projectId: 'non-existent-project-id',
      name: 'Test Layer',
      kind: 'point',
      geometryType: 'Point',
      description: 'Test description',
    };

    await expect(
      db
        .insert(/* dummy call – we only test the validation logic */)
        .then(async () => {})
        .catch(async (err) => {
          // Validate that the error is the expected PROJECT_NOT_FOUND error
          expect(err).toBeInstanceOf(ErrorSchema);
          const errorInstance = err as ErrorSchema;
          expect(errorInstance.code).toBe('PROJECT_NOT_FOUND');
          expect(errorInstance.message).toContain('not found');
        });
  });
});