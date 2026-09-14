/** @type {import('forgepress').ForgePressConfig} */
export default {
  path: '.forgepress',

  provider: {
    type: 'forgejo',
    url: 'http://127.0.0.1:3310',

    repository: {
      owner: 'fred',
      name: 'site',
    },

    commitMessage: 'content: {name}',
  },
}
