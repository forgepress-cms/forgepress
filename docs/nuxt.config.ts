export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['forgepress/nuxt'],

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
})
