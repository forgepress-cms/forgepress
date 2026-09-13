/** @type {import('forgepress').ForgePressConfig} */
export default {
  path: '.forgepress',

  provider: {
    type: 'github',

    repository: {
      owner: 'forgepressjs',
      name: 'forgepress',
    },

    base: 'playgrounds/nuxt',

    commitMessage: 'content: {name}',
  },
}
