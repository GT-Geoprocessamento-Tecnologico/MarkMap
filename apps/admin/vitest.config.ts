import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { geonexoAliases } from './vite.aliases';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: geonexoAliases,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
