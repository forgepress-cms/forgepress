import { defineWebenvConfig } from 'webenv'

export default defineWebenvConfig({
  name: 'my-webenv-playground',

  provider: {
    type: 'github',

    repository: {
      owner: 'freb97',
      name: 'webenv-playground',
    },

    auth: {
      clientSecret: 'my-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    },
  },
})
