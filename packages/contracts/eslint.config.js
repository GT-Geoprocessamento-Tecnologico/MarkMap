import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharedConfig from "../config/eslint/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...sharedConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, "tsconfig.eslint.json"),
        projectService: false,
        tsconfigRootDir: __dirname,
      },
    },
  },
];
