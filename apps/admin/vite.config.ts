import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { geonexoAliases } from './vite.aliases';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: geonexoAliases,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
