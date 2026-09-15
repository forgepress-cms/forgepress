import { vitePlugin as forgepress } from 'forgepress/unplugin'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
    },
  },

  nitro: {
    prerender: {
      routes: ['/', '/admin'],
    },
  },

  hooks: {
    'prepare:types': ({ tsConfig }) => {
      tsConfig.include ??= []
      tsConfig.include.push('../.forgepress/**/*.ts')
    },
  },

  vite: {
    plugins: [forgepress()],
  },
})
