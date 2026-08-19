import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      // The package runs in a browser reader and in Node scripts alike, so both sets
      // of globals are in scope.
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // tsconfig.json covers src and test only. Typed rules on the config files themselves
    // would fail with "file not included in project", and there is nothing to type-check
    // there anyway.
    files: ['*.js', 'vitest.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Last: it switches off the formatting rules that would otherwise argue with Prettier.
  prettier,
])
