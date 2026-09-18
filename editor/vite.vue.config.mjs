import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const ROOT = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: ROOT,

  build: {
    outDir: '../dist/editor',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: 'vue.ts',
      formats: ['es'],
      fileName: () => 'vue.mjs',
    },
  },
})
