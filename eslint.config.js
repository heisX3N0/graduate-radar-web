import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', '.claude/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // Site code runs in the browser (and at build time in Astro frontmatter).
  {
    files: ['src/**'],
    languageOptions: { globals: { ...globals.browser } },
  },
  // Scripts, tests and config files run in Node only.
  {
    files: ['scripts/**', 'tests/**', '*.js', '*.mjs', '*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
];
