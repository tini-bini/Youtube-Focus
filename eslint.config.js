const js = require("@eslint/js");
const globals = require("globals");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "checkout/.env"]
  },
  js.configs.recommended,
  {
    files: ["background.js", "content.js", "script.js", "shared.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.worker,
        YTFCShared: "readonly",
        module: "readonly"
      }
    }
  },
  {
    files: ["eslint.config.js", "scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    }
  }
];
