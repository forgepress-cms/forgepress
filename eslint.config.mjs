import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  stylistic: true,
}, {
  files: ['pnpm-workspace.yaml'],
  rules: {
    'pnpm/yaml-enforce-settings': 'off',
  },
}, {
  files: ['src/**/*.ts', 'src/**/*.vue'],
  ignores: ['src/disk/**', 'src/plugin/**', 'src/unplugin.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['node:*'],
          message: 'Only src/disk and src/plugin run in Node. Everything else has to work in the browser too.',
        },
        {
          group: ['**/disk/*', '**/plugin', '**/plugin/*', '**/unplugin'],
          message: 'src/disk and src/plugin use Node. Code that runs in the browser can\'t import them.',
        },
      ],
    }],
  },
})
