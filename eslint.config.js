import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      // noUncheckedIndexedAccess makes array reads possibly undefined; `!` marks the ones known in range.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent or DOM APIs.' },
        { property: 'outerHTML', message: 'Use textContent or DOM APIs.' },
      ],
    },
  },
);
