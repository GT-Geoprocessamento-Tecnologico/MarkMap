import { MOCK_DB_VERSION, mockDbSchema } from './seed';
import type { MockDb } from './seed';

/** Chave versionada: trocar a versao invalida dados de demonstracao antigos. */
export const MOCK_STORAGE_KEY = 'geonexo.admin.mock.v1';

let cache: MockDb | null = null;

function readStored(): MockDb | null {
  try {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = mockDbSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeStored(db: MockDb): void {
  try {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // localStorage indisponivel (quota/modo privado): o mock segue em memoria.
  }
}

/** Dados já persistidos permanecem intactos. Perfil novo começa vazio. */
export function getDb(): MockDb {
  if (cache !== null) return cache;
  const stored = readStored();
  if (stored !== null) {
    cache = stored;
    return cache;
  }
  return persist({ version: MOCK_DB_VERSION, projects: [], layers: [], features: [] });
}

/** Persiste alteracoes feitas pelos endpoints mock. */
export function persist(db: MockDb): MockDb {
  writeStored(db);
  cache = db;
  return db;
}

/** Zera o demo (usado entre testes). */
export function resetMockDb(): void {
  cache = null;
  try {
    window.localStorage.removeItem(MOCK_STORAGE_KEY);
  } catch {
    // sem storage: nada a limpar
  }
}
