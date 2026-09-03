/** @type {import('webenv').WebenvConfig} */
export default {
  name: 'webenv-playground-nuxt',

  path: '.webenv', // default: '${ROOT}/.webenv'

  provider: {
    type: 'github',

    repository: {
      owner: 'webenvjs',
      name: 'webenv',
    },

    base: 'playgrounds/nuxt',

    commitMessage: 'content: {name}',
  },
}
