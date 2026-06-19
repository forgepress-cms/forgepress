import type { UnpluginFactory } from 'unplugin'

import { createUnplugin } from 'unplugin'

export interface Options {
}

export const unpluginFactory: UnpluginFactory<Options | undefined> = (_options) => {
  return {
    name: 'unplugin-webenv',

    async buildStart() {
      console.log('unplugin-webenv buildStart')
    },

    resolveId(id) {
      console.log('unplugin-webenv resolveId', id)
    },

    load(id) {
      console.log('unplugin-webenv load', id)
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin

export const vitePlugin = unplugin.vite
export const rollupPlugin = unplugin.rollup
export const rolldownPlugin = unplugin.rolldown
export const webpackPlugin = unplugin.webpack
export const rspackPlugin = unplugin.rspack
export const esbuildPlugin = unplugin.esbuild
export const farmPlugin = unplugin.farm
export const bunPlugin = unplugin.bun
