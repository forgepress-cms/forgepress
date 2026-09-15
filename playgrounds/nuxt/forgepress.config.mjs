/** @type {import('forgepress').ForgePressConfig} */
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
}
