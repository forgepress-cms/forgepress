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
  files: ['src/**/*.ts', 'editor/**/*.ts', 'editor/**/*.vue'],
  ignores: ['**/*.d.ts'],
  plugins: { forgepress: architecture },
  rules: {
    'forgepress/layers': 'error',
    'forgepress/entries': 'error',
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
