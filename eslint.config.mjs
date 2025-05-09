import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript", "prettier"],
    plugins: ["eslint-plugin-project-structure"],
    settings: {
      "project-structure/independent-modules-config-path": "independentModules.jsonc"
    },
    rules: {
      "project-structure/independent-modules": "error"
    },
  }),
];

export default eslintConfig;
