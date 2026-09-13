import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const TYPES = fileURLToPath(new URL('./src/editor/types.ts', import.meta.url))

function Types() {
  return {
    name: 'forgepress:editor-types',

    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'index.d.mts',
        source: `${await readFile(TYPES, 'utf8')}\nexport declare const mountEditor: MountEditor\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    ui({
      router: false,
      colorMode: false,
      ui: { colors: { primary: 'brand', neutral: 'zinc' } },
    }),
    Types(),
  ],

  build: {
    outDir: 'dist/editor',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: 'src/editor/index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: [/^virtual:forgepress\//, 'vue'],
    },
  },
})
