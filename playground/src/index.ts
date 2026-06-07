import { defineWebenvConfig } from '../../src'

export default defineWebenvConfig({
  name: 'Playground',

  provider: {
    type: 'github',

    repository: {
      owner: 'freb97',
      name: 'webenv',
    },

    auth: {
      clientSecret: 'github-client-secret',
      redirectUri: 'http://localhost:3000/webenv/callback',
    },
  },
})
