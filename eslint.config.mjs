import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'frontend/**',
      'backend/web_client/**',
      'lib/src/cards/ep.generated.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'lib/src/**/*.ts',
      'lib/scripts/**/*.ts',
      'backend/web/src/**/*.ts',
      'backend/web/scripts/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'lib/scripts/*.ts',
            'backend/web/scripts/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      'no-param-reassign': [
        'error',
        {
          props: true,
          // In-place game engine: these names are intentional mutable drafts.
          // Still bans reassignment and mutating other parameter names.
          ignorePropertyModificationsFor: ['state', 'event', 'board', 'deck'],
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
)
