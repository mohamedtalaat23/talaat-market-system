// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommendedTypeChecked,

  // Global settings
  {
    languageOptions: {
      parserOptions: {
        project: [
          './packages/client/tsconfig.eslint.json',
          './packages/client/tsconfig.json',
          './packages/server/tsconfig.json',
          './packages/desktop/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React plugin (applies to client only via files glob)
  {
    files: ['packages/client/src/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
      'react/prop-types': 'off',          // TypeScript handles this
      'react/display-name': 'off',
      // Hook dependency arrays are a correctness rule in a POS UI: a missing
      // dependency leaves a stale closure inside an open dialog (wrong total,
      // wrong shift, wrong cart). Added after the TransactionSearchModal
      // render-loop regression.
      'react-hooks/exhaustive-deps': 'error',
      // Keep the hooks-order rule on: violating it is a hard runtime crash
      // ("Rendered more hooks than during the previous render"), not a style nit.
      'react-hooks/rules-of-hooks': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Global rules for all TypeScript files
  //
  // The rules below are the ones we can enforce today without suppressions.
  // Rules that were previously relaxed but are still noisy are listed in the
  // comment at the bottom of this block: re-enable them rule-by-rule as the
  // backlog in the corresponding area is paid down (see REVIEW_NOTES).
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      // An unhandled rejected promise in the POS loop means a sale that
      // silently never reaches the server. Never disable this.
      '@typescript-eslint/no-floating-promises': 'error',
      // Dead bindings hide copy/paste bugs (wrong variable in an error path).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Keeps `import type` usage consistent with `verbatimModuleSyntax`.
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // ── Known backlog (documented, not silently dropped) ──────────────────
      // Counts are from `npx eslint` at the time of the review; each line is a
      // follow-up ticket, not a permanent exemption.
      '@typescript-eslint/no-explicit-any': 'off', // ~270 occurrences
      '@typescript-eslint/no-unsafe-assignment': 'off', // ~560
      '@typescript-eslint/no-unsafe-member-access': 'off', // ~1035
      '@typescript-eslint/no-unsafe-argument': 'off', // ~253
      '@typescript-eslint/no-unsafe-call': 'off', // ~82
      '@typescript-eslint/no-unsafe-return': 'off', // ~102
      '@typescript-eslint/no-misused-promises': 'off', // ~194 (async handlers on onClick)
      '@typescript-eslint/no-non-null-assertion': 'off', // ~45
      '@typescript-eslint/require-await': 'off', // ~24
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      'no-control-regex': 'off', // used deliberately by the barcode sanitiser
    },
  },

  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/*.js',     // Only lint TS files
      '**/*.d.ts',
      'eslint.config.js',
    ],
  },
);
