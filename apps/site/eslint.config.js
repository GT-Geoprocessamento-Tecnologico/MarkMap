// Self-contained flat config for apps/site (eslint 8.57 + typescript-eslint 7).
// The shared packages/config/eslint.config.js is NOT used: it imports plugins
// with no installed dependencies. Everything needed here is installed locally.
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// eslint-plugin-react-hooks is declared in package.json; the rules are wired in
// as soon as the coordinator runs pnpm install (they are skipped meanwhile so
// `pnpm lint` never fails on a missing module).
const reactHooks = (() => {
  try {
    return require("eslint-plugin-react-hooks");
  } catch {
    return null;
  }
})();

const baseRules = {
  "no-console": ["error", { allow: ["warn", "error"] }],
  "no-debugger": "error",
  "prefer-const": "error",
  "no-var": "error",
  eqeqeq: ["error", "smart"],
};

export default [
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      // Projetos nativos do Capacitor e suas saídas: `cap add`/`cap sync` copiam
      // o bundle web e o Gradle/Xcode geram artefatos. Sem isto o lint analisaria
      // JavaScript minificado que não pertence a este repositório.
      "**/android/**",
      "**/ios/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      ...(reactHooks ? { "react-hooks": reactHooks } : {}),
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...baseRules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      ...(reactHooks
        ? {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
          }
        : {}),
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: { ...baseRules },
  },
];
