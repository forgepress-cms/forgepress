import type { NuxtModule } from '@nuxt/schema'
import type { Options } from './project'
import { join, relative } from 'node:path'
import { addPluginTemplate, addVitePlugin, defineNuxtModule } from '@nuxt/kit'
import { configFile } from '../disk/config'
import { toPosix } from '../disk/paths'
import { vitePlugin } from './index'
import { loadProject } from './project'

export interface ModuleOptions extends Options {
  preview?: boolean
}

const PREVIEW_PLUGIN = `import { defineNuxtPlugin, refreshNuxtData, usePreviewMode } from '#app'
import { enablePreview, onPreviewChange, previewing } from 'forgepress/preview'

export default defineNuxtPlugin({
  name: 'forgepress:preview',
  setup(nuxtApp) {
    enablePreview()

    const { enabled } = usePreviewMode({ shouldEnable: previewing })

    onPreviewChange(() => nuxtApp.runWithContext(() => {
      enabled.value = previewing()

      return refreshNuxtData()
    }))
  },
})
`

const forgepress: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: { name: 'forgepress', configKey: 'forgepress' },

  async setup(options, nuxt) {
    const { root, config } = await loadProject(nuxt.options.rootDir, options)

    addVitePlugin(vitePlugin({ ...options, root }))

    nuxt.hook('prepare:types', ({ tsConfig, nodeTsConfig }) => {
      tsConfig.include ??= []
      tsConfig.include.push(toPosix(relative(nuxt.options.buildDir, join(root, config.paths.dir, '**/*.ts'))))

      const file = configFile(root)

      if (file) {
        nodeTsConfig.include ??= []
        nodeTsConfig.include.push(toPosix(relative(nuxt.options.buildDir, join(root, file))))
      }
    })

    if (options.preview !== false)
      addPluginTemplate({ filename: 'forgepress/preview.client.mjs', getContents: () => PREVIEW_PLUGIN, mode: 'client' })
  },
})

export default forgepress
