import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetMockDb } from '../lib/mock';

// jsdom nao implementa scrollTo e o router do TanStack chama na navegacao.
if (typeof window !== "undefined") window.scrollTo = () => undefined;

afterEach(() => {
  cleanup();
  resetMockDb();
});
