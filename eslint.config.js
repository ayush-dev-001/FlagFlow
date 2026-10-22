import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.claude/**',
      '.agents/**',
      '.aider-desk/**',
      'apps/api/src/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  // TS config files outside every workspace tsconfig get syntax-only rules.
  {
    files: ['*.ts', 'security/**/*.ts', 'apps/api/prisma.config.ts'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['{apps,packages}/**/*.{ts,tsx}'],
    ignores: ['apps/api/prisma.config.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      // Express tells error handlers apart by arity, so `_next` must stay.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // supertest types response bodies as `any`; asserting on them is the point of a test.
  {
    files: ['**/*.test.{ts,tsx}', 'apps/*/src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['apps/{dashboard,demo-web}/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
