// Local flat config for @geonexo/maps. The shared
// packages/config/eslint.config.js is currently broken (see docs/api/README.md
// defects 5-10 and docs/gis/HANDOFF-GIS.md); this minimal config enforces the
// PRD gates that matter here (no `any`, no unused vars) without depending on
// it. Revisit when the shared config is fixed (quality/security ownership).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
);
