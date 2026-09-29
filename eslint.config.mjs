import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: ["node_modules/**", "dist/**", ".venv/**"],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,mjs}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ARGV: "readonly",
        Debugger: "readonly",
        GIRepositoryGType: "readonly",
        globalThis: "readonly",
        imports: "readonly",
        Intl: "readonly",
        log: "readonly",
        logError: "readonly",
        print: "readonly",
        printerr: "readonly",
        window: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
      },
    },
  },

  prettier,
];
