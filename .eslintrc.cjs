// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  ignorePatterns: [
    "dist",
    ".eslintrc.cjs",
    "vite.config.ts",
    "tailwind.config.ts",
    "/src-tauri/**",
    "/components/**",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json", "./tsconfig.node.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["react-refresh", "import"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/consistent-type-definitions": "off",
    "import/order": [
      "error",
      {
        groups: [
          ["builtin", "external"], // Node.js built-ins and external modules
          ["internal"], // Internal modules
          ["parent", "sibling"], // Parent and sibling imports
          ["index"], // Index files
        ],
        "newlines-between": "always", // Enforce newlines between groups
        alphabetize: {
          order: "asc", // Sort imports alphabetically
          caseInsensitive: true, // Ignore case when sorting
        },
      },
    ],
  },
};
