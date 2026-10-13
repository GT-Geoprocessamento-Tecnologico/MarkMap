import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Sob `turbo lint build test` vários pacotes sobem pools ao mesmo tempo e o
    // arranque dos forks do ui estoura o timeout do pool runner ("Timeout waiting
    // for worker to respond"). Um worker só mantém o arranque determinístico.
    maxWorkers: 1,
  },
});
