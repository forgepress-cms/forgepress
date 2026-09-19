import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const TYPES = fileURLToPath(new URL('./types.ts', import.meta.url))

const ICONS = {
  arrowDown: 'i-hugeicons-arrow-down-02',
  arrowLeft: 'i-hugeicons-arrow-left-02',
  arrowRight: 'i-hugeicons-arrow-right-02',
  arrowUp: 'i-hugeicons-arrow-up-02',
  caution: 'i-hugeicons-alert-circle',
  check: 'i-hugeicons-tick-02',
  chevronDoubleLeft: 'i-hugeicons-arrow-left-double',
  chevronDoubleRight: 'i-hugeicons-arrow-right-double',
  chevronDown: 'i-hugeicons-arrow-down-01',
  chevronLeft: 'i-hugeicons-arrow-left-01',
  chevronRight: 'i-hugeicons-arrow-right-01',
  chevronUp: 'i-hugeicons-arrow-up-01',
  close: 'i-hugeicons-cancel-01',
  copy: 'i-hugeicons-copy-01',
  copyCheck: 'i-hugeicons-copy-check',
  dark: 'i-hugeicons-moon-02',
  drag: 'i-hugeicons-drag-drop-vertical',
  ellipsis: 'i-hugeicons-more-horizontal',
  error: 'i-hugeicons-cancel-circle',
  external: 'i-hugeicons-arrow-up-right-01',
  eye: 'i-hugeicons-view',
  eyeOff: 'i-hugeicons-view-off',
  file: 'i-hugeicons-file-01',
  folder: 'i-hugeicons-folder-01',
  folderOpen: 'i-hugeicons-folder-open',
  hash: 'i-hugeicons-hashtag',
  info: 'i-hugeicons-information-circle',
  light: 'i-hugeicons-sun-03',
  loading: 'i-hugeicons-loading-03',
  menu: 'i-hugeicons-menu-01',
  minus: 'i-hugeicons-minus-sign',
  panelClose: 'i-hugeicons-sidebar-left-01',
  panelOpen: 'i-hugeicons-sidebar-left',
  plus: 'i-hugeicons-plus-sign',
  reload: 'i-hugeicons-rotate-left-01',
  search: 'i-hugeicons-search-01',
  stop: 'i-hugeicons-square',
  star: 'i-hugeicons-star',
  success: 'i-hugeicons-checkmark-circle-02',
  system: 'i-hugeicons-computer',
  tip: 'i-hugeicons-bulb',
  upload: 'i-hugeicons-upload-01',
  warning: 'i-hugeicons-alert-02',
}

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
  root: ROOT,

  plugins: [
    vue(),
    ui({
      router: false,
      colorMode: false,
      icon: {
        clientBundle: {
          icons: Object.values(ICONS),
          scan: { globInclude: ['**/*.{vue,ts}'] },
        },
      },
      ui: {
        colors: { primary: 'brand', neutral: 'umber' },
        icons: ICONS,
        switch: { slots: { base: 'rounded-md', thumb: 'rounded-xs' } },
        modal: { slots: { title: 'font-display text-lg', footer: 'flex-wrap' } },
        pageCard: { slots: { title: 'font-display text-lg' } },
        button: {
          compoundVariants: [
            { color: 'neutral', variant: ['ghost', 'outline'], class: 'hover:bg-accented active:bg-accented dark:hover:bg-elevated dark:active:bg-elevated' },
          ],
        },
      },
    }),
    Types(),
  ],

  build: {
    outDir: '../dist/editor',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: 'index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: [/^virtual:forgepress\//, 'vue'],
    },
  },
})
