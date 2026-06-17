// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  vite: {
    resolve: {
      alias: {
        webenv: new URL('./webenv.ts', import.meta.url).pathname,
      },
    },
    optimizeDeps: {
      exclude: ['webenv'],
    },
  },
})
