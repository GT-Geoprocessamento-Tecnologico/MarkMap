import { defineConfig } from "vite";
import { isAbsolute, resolve } from "node:path";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { generateShellManifest } from "./scripts/generate-shell-manifest.mjs";
import { geonexoAliases } from "./vite.aliases";

function shellManifestPlugin() {
  let outDir = "dist";
  return {
    name: "geonexo-shell-manifest",
    configResolved(config: { build: { outDir: string }; root: string }) {
      outDir = isAbsolute(config.build.outDir)
        ? config.build.outDir
        : resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const result = await generateShellManifest(outDir);
      process.stdout.write(`GeoNexo shell manifest: ${result.assets.length} assets (${result.version})\n`);
    },
  };
}

export default defineConfig({
  optimizeDeps: {
    exclude: ["maplibre-gl"],
    include: [
      "three",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/examples/jsm/controls/OrbitControls.js",
    ],
  },
  plugins: [react(), basicSsl(), shellManifestPlugin()],
  resolve: {
    alias: geonexoAliases,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Listen on all network interfaces
  },
  preview: {
    https: false,
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
