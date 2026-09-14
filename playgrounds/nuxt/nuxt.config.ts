import { fileURLToPath } from 'node:url'
import tailwind from '@tailwindcss/vite'
import { vitePlugin as forgepress } from '../../src/unplugin'

const forgepressSrc = fileURLToPath(new URL('../../src', import.meta.url))

const forgepressEditor = fileURLToPath(new URL('../../dist/editor/index.mjs', import.meta.url))

const forgepressReader = fileURLToPath(new URL('../../src/query/fetch.ts', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  alias: {
    'forgepress/editor': forgepressEditor,
    'forgepress': forgepressSrc,
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          'forgepress': [forgepressSrc],
          '#content-reader': [forgepressReader],
          'forgepress/editor': [fileURLToPath(new URL('../../dist/editor/index.d.mts', import.meta.url))],
        },
      },
    },
  },

  hooks: {
    'prepare:types': ({ tsConfig }) => {
      tsConfig.include ??= []
      tsConfig.include.push('../.forgepress/**/*.ts')
      tsConfig.include.push('../forgepress.config.mjs')
    },
  },

  vite: {
    plugins: [forgepress(), tailwind()],
  },
})
