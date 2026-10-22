// eslint.config.js
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'import': importPlugin,
      'prettier': prettier,
      'unused-imports': unusedImports,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [resolve(__dirname, '../../tsconfig.json')],
        },
        node: {
          paths: [resolve(__dirname, '../../src')],
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        alias: [
          ['@markmap/*', [resolve(__dirname, '../../packages/*/src')]],
          ['@markmap', resolve(__dirname, '../../packages')],
        ],
      },
    },
    rules: {
      // TypeScript ESLint rules
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-literals': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/triple-slash-reference': 'off',

      // React
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/react-only': 'error',

      // Import
      'import/no-duplicates': 'error',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/no-unresolved': 'error',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // Prettier
      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      // Unused imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['*.js', '*.cjs', '*.mjs'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'import': importPlugin,
      'prettier': prettier,
      'unused-imports': unusedImports,
    },
    rules: {
      // CommonJS
      'no-undef': 'error',
      'no-unused-vars': ['error', { vars: 'local', args: 'none' }],

      // Import
      'import/no-duplicates': 'error',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/no-unresolved': 'error',
      'import/extensions': ['error', 'never'],

      // Prettier
      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      // Unused imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
];

export default config;