/* @ts-check */

import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

/* utility to translate legacy eslintrc-style configs into flat configs */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = tseslint.config(
  ...compat.config({
    extends: ["next/core-web-vitals"],
  }),
  eslintReact.configs["recommended-type-checked"],
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  eslintPluginUnicorn.configs.recommended,
  eslintReact.configs["recommended-type-checked"],
  eslintConfigPrettier,
  {
    ignores: ["coverage", "node_modules", ".next", "src/components/ui/**"],
  },
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "unicorn/better-regex": "warn",
      "unicorn/prevent-abbreviations": [
        "error",
        {
          allowList: {
            env: true,
            props: true,
            Props: true,
            ref: true,
            Ref: true,
            utils: true,
          },
        },
      ],
      "@eslint-react/no-useless-fragment": "warn",
      "@eslint-react/prefer-react-namespace-import": "error",
      "@eslint-react/prefer-shorthand-boolean": "warn",
      "@eslint-react/no-complex-conditional-rendering": "error",
      "@eslint-react/hooks-extra/no-unnecessary-use-callback": "error",
      "@eslint-react/hooks-extra/no-unnecessary-use-memo": "error",
      "@eslint-react/naming-convention/component-name": ["error", "PascalCase"],
      "@eslint-react/naming-convention/filename": [
        "error",
        { rule: "kebab-case" },
      ],
      "@eslint-react/naming-convention/filename-extension": "error",
      "@eslint-react/naming-convention/use-state": "error",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
);

export default eslintConfig;
