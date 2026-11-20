import antfu from '@antfu/eslint-config'
import architecture from './scripts/architecture.ts'

export default antfu({
  vue: true,
  stylistic: true,
  gitignore: { recursive: true },
  ignores: originals => originals.filter(pattern => pattern !== '**/output'),
}, {
  files: ['pnpm-workspace.yaml'],
  rules: {
    'pnpm/yaml-enforce-settings': 'off',
  },
}, {
  plugins: { forgepress: architecture },
}, {
  files: ['src/**/*.ts', 'editor/**/*.ts', 'editor/**/*.vue'],
  ignores: ['**/*.d.ts'],
  rules: {
    'forgepress/layers': 'error',
    'forgepress/entries': 'error',
  },
}, {
  files: ['src/**/*.ts', 'editor/**/*.ts', 'scripts/**/*.ts', 'test/**/*.ts'],
  ignores: ['**/*.d.ts', 'test/fixtures/**'],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    'ts/await-thenable': 'error',
    'ts/no-deprecated': 'error',
    'ts/no-floating-promises': 'error',
    'ts/no-misused-promises': 'error',
    'ts/no-unnecessary-type-assertion': 'error',
    'ts/only-throw-error': 'error',
    'ts/switch-exhaustiveness-check': 'error',
  },
}, {
  files: ['editor/**/*.vue'],
  rules: {
    'vue/define-props-declaration': ['error', 'type-based'],
    'vue/no-setup-props-reactivity-loss': 'error',
    'vue/no-undef-components': ['error', { ignorePatterns: ['^U[A-Z]'] }],
    'vue/no-unused-properties': 'error',
    'vue/require-typed-ref': 'error',
  },
}, {
  files: ['src/**/*.ts', 'editor/**/*.ts', 'editor/**/*.vue', 'scripts/**/*.ts'],
  ignores: ['**/*.d.ts'],
  rules: {
    'complexity': ['error', 20],
    'max-lines': ['error', { max: 400, skipBlankLines: true }],
  },
}, {
  files: ['src/**/*.ts', 'editor/**/*.ts', 'editor/pages/**/*.vue', 'scripts/**/*.ts'],
  ignores: ['**/*.d.ts', 'editor/composables/**/use*.ts'],
  rules: {
    'unicorn/filename-case': ['error', { case: 'kebabCase' }],
  },
}, {
  files: ['editor/composables/**/use*.ts'],
  rules: {
    'unicorn/filename-case': ['error', { case: 'camelCase', checkDirectories: false }],
  },
}, {
  files: ['editor/App.vue', 'editor/components/**/*.vue'],
  rules: {
    'unicorn/filename-case': ['error', { case: 'pascalCase', checkDirectories: false }],
  },
})
