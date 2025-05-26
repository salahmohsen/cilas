import perfectionist from 'eslint-plugin-perfectionist';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.config({
    rules: {
      'prettier/prettier': [
        'error',
        {
          plugins: ['prettier-plugin-tailwindcss'],
          arrowParens: 'always',
          trailingComma: 'none',
          singleQuote: true,
          endOfLine: 'lf',
          printWidth: 80,
          tabWidth: 2
        },
        {
          usePrettierrc: false
        }
      ],

      'project-structure/independent-modules': 'error',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'react/react-in-jsx-scope': 'off',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/alt-text': 'warn',
      ...perfectionist['configs']['recommended-line-length'].rules
    },
    settings: {
      'project-structure/independent-modules-config-path':
        'independentModules.jsonc',
      ...perfectionist.configs['recommended-alphabetical'].settings
    },
    extends: [
      'next/core-web-vitals',
      'next/typescript',
      'plugin:prettier/recommended',
      'plugin:jsx-a11y/recommended'
    ],
    plugins: ['project-structure', 'perfectionist', 'prettier', 'jsx-a11y']
  })
];

export default eslintConfig;
