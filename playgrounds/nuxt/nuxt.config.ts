import { vitePlugin as webenv } from '../../src/unplugin'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  alias: {
    webenv: '../../../src',
  },

  hooks: {
    'prepare:types': ({ tsConfig }) => {
      tsConfig.include ??= []
      tsConfig.include.push('../.webenv/**/*.ts')
    },
  },

  vite: {
    plugins: [webenv()],
  },
})
