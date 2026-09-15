import antfu from '@antfu/eslint-config'

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
  files: ['src/**/*.ts', 'src/**/*.vue'],
  ignores: ['src/cli/**', 'src/disk/**', 'src/plugin/**', 'src/unplugin.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['node:*'],
          message: 'Only src/cli, src/disk and src/plugin run in Node. Everything else has to work in the browser too.',
        },
        {
          group: ['**/cli/*', '**/disk/*', '**/plugin', '**/plugin/*', '**/unplugin'],
          message: 'src/cli, src/disk and src/plugin use Node. Code that runs in the browser can\'t import them.',
        },
      ],
    }],
  },
})
