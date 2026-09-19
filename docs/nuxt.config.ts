export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: {
    enabled: true,
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n',
    'forgepress/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  ui: {
    colorMode: false,
  },

  fonts: {
    families: [
      { name: 'Bricolage Grotesque', provider: 'google', weights: ['400 800'] },
    ],
  },

  i18n: {
    baseUrl: 'https://forgepress.b-cdn.net',
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    customRoutes: 'meta',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
    ],
  },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  nitro: {
    prerender: {
      routes: ['/', '/de', '/admin'],
    },
  },
})
