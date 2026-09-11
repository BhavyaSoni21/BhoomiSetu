import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// KNOWN_RISKS.md LOW-1: this project had no lint config/script at all -
// style/correctness issues (a missing hook dependency, an accidental `any`)
// were only ever caught by tsc, which doesn't check for those. Deliberately
// the non-type-checked "recommended" preset rather than
// recommendedTypeChecked/strict - being added to an existing ~95-file
// codebase with no prior lint history, not written test-first against a
// ruleset; a stricter preset would surface a large, unrelated backlog of
// pre-existing findings instead of giving this project a clean baseline to
// build on going forward. Tighten it later as a deliberate, separate
// decision.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.vite/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // eslint-plugin-react-hooks v7 bundles a much larger, newer rule set
      // (React Compiler-oriented checks like set-state-in-effect, purity,
      // etc., many as errors by default under `recommended`) that this
      // codebase was never written against - only opting into the two
      // classic, well-established rules every React 18 (non-Compiler)
      // codebase lints against.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Test files reference components purely for rendering, not as
      // Fast-Refresh boundaries - this rule doesn't apply to them.
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Plain Node/CommonJS build-tool config files, not app/browser code.
    files: ['*.config.{js,cjs,ts}', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
