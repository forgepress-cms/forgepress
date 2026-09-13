import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  stylistic: true,
}, {
  files: ['pnpm-workspace.yaml'],
  rules: {
    'pnpm/yaml-enforce-settings': 'off',
  },
})
