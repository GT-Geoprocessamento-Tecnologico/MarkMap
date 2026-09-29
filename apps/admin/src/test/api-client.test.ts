import { describe, expect, it } from 'vitest';
import { listProjects } from '../lib/api-client';

describe('api-client (mock)', () => {
  it('devolve a pagina de projetos semeada com paginacao', async () => {
    const page = await listProjects();

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((project) => project.name)).toContain('Reconhecimento Centro');

    const first = await listProjects({ limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTypeOf('string');
  });
});
