import type { ForgePressConfig } from 'forgepress'

export default {
  path: '../../.forgepress',

  provider: {
    type: 'github',

    repository: {
      owner: 'forgepress-cms',
      name: 'forgepress',
    },

    base: 'playgrounds/nuxt',

    commitMessage: 'content: {name}',
  },
} satisfies ForgePressConfig
