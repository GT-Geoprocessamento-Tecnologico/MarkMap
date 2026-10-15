import { describe, expect, it } from 'vitest';
import { createSeedDb } from '../lib/mock/seed';
import { getDb, persist, MOCK_STORAGE_KEY } from '../lib/mock/storage';
import { listProjects } from '../lib/api-client';

describe('api-client (mock)', () => {
  it('uma instalação limpa não carrega projetos, camadas ou feições demonstrativas', async () => {
    const page = await listProjects();
    expect(page.items).toEqual([]);
    expect(getDb()).toMatchObject({ projects: [], layers: [], features: [] });
  });

  it('lê registros anteriormente persistidos sem reescrevê-los', () => {
    const old = createSeedDb();
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(old));
    expect(getDb()).toEqual(old);
  });

  it('paginação só usa fixtures quando o teste pede explicitamente', async () => {
    persist(createSeedDb());
    const page = await listProjects();

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((project) => project.name)).toContain('Reconhecimento Centro');

    const first = await listProjects({ limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTypeOf('string');
  });
});
