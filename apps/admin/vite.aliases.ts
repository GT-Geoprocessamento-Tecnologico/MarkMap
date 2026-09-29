import path from 'node:path';

/**
 * Single source for module aliases: vite.config.ts (dev/build),
 * vitest.config.ts (tests) and tsconfig.json `paths` must stay in sync
 * (50-CONTRATOS-DE-INTEGRACAO.md - aliases consistentes).
 *
 * A string alias matches the bare specifier AND every subpath, so
 * `@geonexo/ui` resolves to `packages/ui/src` and `@geonexo/ui/Button`
 * resolves to `packages/ui/src/Button`, mirroring the `@geonexo/ui/*`
 * tsconfig entry.
 *
 * This file is loaded only through Vite/Vitest config bundling, which
 * injects `__dirname` pointing at apps/admin (it is intentionally outside
 * the tsconfig `include`: Node types are not installed here).
 */
export const geonexoAliases: Record<string, string> = {
  '@geonexo/ui': path.resolve(__dirname, '../../packages/ui/src'),
  '@geonexo/maps': path.resolve(__dirname, '../../packages/maps/src'),
  '@geonexo/geo': path.resolve(__dirname, '../../packages/geo/src'),
  '@geonexo/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
  '@': path.resolve(__dirname, 'src'),
};
