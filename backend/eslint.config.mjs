import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// KNOWN_RISKS.md LOW-1: this project had no lint config/script at all -
// style/correctness issues were only ever caught by tsc, which doesn't
// catch unused vars, accidental `any`, floating promises, etc. Deliberately
// the non-type-checked "recommended" preset rather than
// recommendedTypeChecked/strict - this is being added to an existing
// ~150-file codebase with no prior lint history, not written test-first
// against a ruleset; a stricter preset would surface a large, unrelated
// backlog of pre-existing findings instead of giving this project a clean
// baseline to build on going forward. Tighten it later as a deliberate,
// separate decision.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // NestJS's own DI/decorator conventions (constructor-injected
      // services, DTO classes with only decorated properties) trip the
      // default no-unused-vars/no-empty-object-type heuristics constantly -
      // not a real bug class here, so these are relaxed rather than
      // fighting the framework's own idioms.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Every e2e spec in this project uses `import request = require('supertest')`
    // (not `import request from 'supertest'`) - a deliberate, consistent
    // choice across all 20+ spec files (supertest's default export doesn't
    // play well with esModuleInterop under ts-jest's CJS transform), not a
    // stray require() to flag.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
