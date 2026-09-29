/**
 * Shared ESLint configuration for the GeoNexo monorepo.
 * Exported as the default export so that `import { default as eslintConfig } from '@geonexo/config/eslint'` works.
 */
export default {
  // Add your base ESLint rules here.
  // For now we provide an empty configuration object.
  rules: {
    // example rule: '@typescript-eslint/no-explicit-any': 'off',
  },
  settings: {
    'import/resolver': {
      alias: {
        map: {
          '^@geonexo/(.*)$': '../../packages/*/src/$1',
        },
        extensions: ['.js', '.ts', '.json'],
      },
    },
  },
};