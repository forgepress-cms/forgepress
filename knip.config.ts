import type { KnipConfig } from 'knip'
import build from './build.config.mjs'

const published = build.entries
  .flatMap(entry => entry.type === 'bundle' ? [entry.input].flat() : [])
  .map(file => file.replace(/^\.\//, ''))

export default {
  workspaces: {
    '.': {
      entry: published,
      project: ['src/**/*.ts', 'editor/**/*.{ts,vue,css}', 'scripts/**/*.{ts,mjs}', 'test/**/*.ts'],
      ignore: ['test/fixtures/**'],
      vite: { config: ['editor/vite.config.mjs', 'editor/vite.vue.config.mjs'] },
    },
    'playgrounds/next': {
      next: false,
      entry: ['app/**/*.{ts,tsx}', 'next.config.ts', 'forgepress.config.ts'],
    },
    'playgrounds/nuxt': {
      entry: ['forgepress.config.ts'],
      ignoreDependencies: ['vue-router', 'vue-tsc'],
    },
    'docs': {
      entry: ['forgepress.config.ts'],
      ignoreDependencies: ['@iconify-json/lucide', 'vue-tsc'],
    },
  },
} satisfies KnipConfig
