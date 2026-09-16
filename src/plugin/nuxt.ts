import type { Options } from './project'
import { join, relative } from 'node:path'
import { toPosix } from '../disk/paths'
import { vitePlugin } from './index'
import { loadProject } from './project'

export interface ModuleOptions extends Options {
  preview?: boolean
}

interface NuxtHooks {
  'vite:extend': (context: { config: { plugins?: unknown[] } }) => void
  'prepare:types': (context: { tsConfig: { include?: string[] } }) => void
}

export interface Nuxt {
  options: {
    rootDir: string
    buildDir: string
    plugins: unknown[]
    build: { templates: unknown[] }
    forgepress?: ModuleOptions
  }
  hook: <TName extends keyof NuxtHooks>(name: TName, handler: NuxtHooks[TName]) => unknown
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

async function forgepress(inline: ModuleOptions, nuxt: Nuxt): Promise<void> {
  const options = { ...nuxt.options.forgepress, ...inline }
  const { root, config } = await loadProject(nuxt.options.rootDir, options)
  const plugin = vitePlugin({ ...options, root })

  nuxt.hook('vite:extend', ({ config: vite }) => {
    vite.plugins ??= []
    vite.plugins.push(plugin)
  })

  nuxt.hook('prepare:types', ({ tsConfig }) => {
    tsConfig.include ??= []
    tsConfig.include.push(toPosix(relative(nuxt.options.buildDir, join(root, config.paths.dir, '**/*.ts'))))
  })

  if (options.preview === false)
    return

  const filename = 'forgepress/preview.client.mjs'

  nuxt.options.build.templates.push({ filename, getContents: () => PREVIEW_PLUGIN })
  nuxt.options.plugins.unshift({ src: join(nuxt.options.buildDir, filename), mode: 'client' })
}

forgepress.getMeta = async () => ({ name: 'forgepress', configKey: 'forgepress' })

export default forgepress
