import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { geonexoAliases } from './vite.aliases';

export default defineConfig({
  optimizeDeps: { exclude: ['maplibre-gl'] },
  plugins: [react(), basicSsl()],
  resolve: {
    alias: geonexoAliases,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Listen on all network interfaces
  },
});
