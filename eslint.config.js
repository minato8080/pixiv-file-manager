import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginImport from "eslint-plugin-import";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["./src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["./src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["./src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    settings: {
      "import/resolver": {
        alias: {
          map: [
            ["@", "./"],
            ["@/components/*", "./components/*"],
            ["@/utils/*", "./utils/*"],
            ["@/lib/*", "./lib/*"],
            ["@/src/*", "./src/*"],
            ["@/styles/*", "./styles/*"],
            ["@/bindings/*", "./src-tauri/bindings/*"],
          ],
          extensions: [".ts", ".tsx", ".js", ".jsx"], // 解決したい拡張子
        },
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "none",
        },
      ],
      "import/no-unresolved": "off",
      "import/order": [
        "error",
        { groups: [["builtin", "external", "internal"]] },
      ],
    },
    extends: [
      tseslint.configs.recommended,
      js.configs.recommended,
      pluginReact.configs.flat.recommended,
      pluginImport.flatConfigs.recommended,
      pluginReact.configs.flat["jsx-runtime"],
    ],
  },
]);
