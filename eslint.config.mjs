import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Vendored by `pnpm onnx:copy`, not written here. Prettier skips it via
    // `.gitignore`; ESLint has no such default.
    "public/onnx/**",
    "next-env.d.ts",
  ]),

  ...nextVitals,
  ...nextTs,

  // Type-aware linting. This is the half of typescript-eslint that needs a real
  // TS program, and it is what catches floating promises in route handlers --
  // the class of bug most likely to bite us once ingestion runs in the background.
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Project standard: no `any`, and API responses typed end to end.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Must stay last: switches off every ESLint rule that overlaps with Prettier.
  prettier,
]);

export default eslintConfig;
