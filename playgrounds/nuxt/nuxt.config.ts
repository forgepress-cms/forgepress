import { fileURLToPath } from 'node:url'
import tailwind from '@tailwindcss/vite'
import { vitePlugin as webenv } from '../../src/unplugin'

const webenvSrc = fileURLToPath(new URL('../../src', import.meta.url))

const webenvEditor = fileURLToPath(new URL('../../dist/editor/index.mjs', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  alias: {
    'webenv/editor': webenvEditor,
    'webenv': webenvSrc,
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          'webenv': [webenvSrc],
          'webenv/editor': [fileURLToPath(new URL('../../dist/editor/index.d.mts', import.meta.url))],
        },
      },
    },
  },

  hooks: {
    'prepare:types': ({ tsConfig }) => {
      tsConfig.include ??= []
      tsConfig.include.push('../.webenv/**/*.ts')
      tsConfig.include.push('../webenv.config.mjs')
    },
  },

  vite: {
    plugins: [webenv(), tailwind()],
  },
})
