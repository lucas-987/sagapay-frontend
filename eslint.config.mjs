import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { featureImports } from "./tooling/feature-imports.ts";

export default defineConfig(
  globalIgnores([
    "dist/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    "src/api/generated/",
  ]),
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { architecture: { rules: { "feature-imports": featureImports } } },
    rules: { "architecture/feature-imports": "error" },
  },
);
