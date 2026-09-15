import tailwind from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['forgepress/nuxt'],

  hooks: {
    'prepare:types': ({ tsConfig }) => {
      tsConfig.include ??= []
      tsConfig.include.push('../forgepress.config.mjs')
    },
  },

  vite: {
    plugins: [tailwind()],
  },
})
