export default {
  path: '../.forgepress',

  provider: {
    type: 'github',

    repository: {
      owner: 'forgepress-cms',
      name: 'forgepress',
      branch: 'main',
    },

    base: 'docs',

    commitMessage: 'docs: {name}',
  },
}
