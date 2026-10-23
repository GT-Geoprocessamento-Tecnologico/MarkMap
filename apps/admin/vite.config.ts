import { defineConfig } from "vite";
import { isAbsolute, resolve } from "node:path";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { generateShellManifest } from "./scripts/generate-shell-manifest.mjs";
import {
  verifyRelease,
  validateArtifacts,
} from "../../scripts/version-release-guard.mjs";
import { geonexoAliases } from "./vite.aliases";

function shellManifestPlugin() {
  let outDir = "dist";
  let repositoryRoot = process.cwd();
  let buildSucceeded = false;
  const production = process.env.VERCEL_ENV === "production";
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  return {
    name: "markmap-shell-manifest",
    apply: "build" as const,
    configResolved(config: { build: { outDir: string }; root: string }) {
      repositoryRoot = resolve(config.root, "../..");
      outDir = isAbsolute(config.build.outDir)
        ? config.build.outDir
        : resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      const release = await verifyRelease({
        root: repositoryRoot,
        production,
        buildSha,
      });
      process.stdout.write(`MarkMap release version: ${release.version}\n`);
    },
    buildEnd(error?: Error) {
      buildSucceeded = !error;
    },
    async closeBundle() {
      if (!buildSucceeded) return;
      const result = await generateShellManifest(outDir);
      await validateArtifacts({
        root: repositoryRoot,
        dist: outDir,
        production,
        expectedBuildSha: buildSha,
      });
      process.stdout.write(
        `GeoNexo shell manifest: ${result.assets.length} assets (${result.version})\n`,
      );
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
    port: 5177,
    strictPort: false,
    host: true, // Listen on all network interfaces
  },
  preview: {
    https: false,
    host: "127.0.0.1",
    port: 5177,
    strictPort: false,
  },
});
