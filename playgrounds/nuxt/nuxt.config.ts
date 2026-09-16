import tailwind from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['forgepress/nuxt'],

  vite: {
    plugins: [tailwind()],
  },
})
