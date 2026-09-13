import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '#content-source': fileURLToPath(new URL('./src/disk/source.ts', import.meta.url)),
    },
  },

  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
