// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules (strict)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global settings
  {
    languageOptions: {
      parserOptions: {
        project: [
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
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Global rules for all TypeScript files
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      // Explicit types on exports (good for a library/API boundary)
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      // No any — use unknown instead
      '@typescript-eslint/no-explicit-any': 'error',
      // No non-null assertions — be explicit
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // No floating promises
      '@typescript-eslint/no-floating-promises': 'error',
      // Require await in async functions
      '@typescript-eslint/require-await': 'error',
      // No unused vars (use underscore prefix to suppress)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
