import { fileURLToPath } from 'node:url'
import tailwind from '@tailwindcss/vite'
import { vitePlugin as webenv } from '../../src/unplugin'

// The library lives at the repo root, so it is live-linked by path rather than
// installed as a package (bun copies `file:` deps and can't `workspace:*` the root).
const webenvSrc = fileURLToPath(new URL('../../src', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  alias: {
    webenv: webenvSrc,
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          webenv: [webenvSrc],
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
    // The editor is consumed from source here, so its stylesheet compiles in this app's Vite.
    plugins: [webenv(), tailwind()],
  },
})
