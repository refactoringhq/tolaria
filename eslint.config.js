import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import * as eslintConfig from 'eslint/config'

export default eslintConfig.defineConfig([
  eslintConfig.globalIgnores([
    'dist',
    'apps/web/dist',
    'coverage',
    'site/.vitepress/cache/',
    'site/.vitepress/dist/',
    'site/landing/',
    'src-tauri/resources/mcp-server/',
    'src-tauri/target/',
    'src-tauri/gen/',
    'tools/',
    'videos/',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/refs': 'error',
      'react-hooks/set-state-in-effect': 'error',
    },
  },
])
