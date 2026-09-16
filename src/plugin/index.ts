import type { ServerResponse } from 'node:http'
import type { UnpluginFactory, UnpluginInstance } from 'unplugin'
import type { Options } from './project'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'
import { createUnplugin } from 'unplugin'
import { buildOutput } from '../disk/output'
import { isInside, toPosix } from '../disk/paths'
import { once } from '../utils/once'
import { createDevContent } from './dev'
import { loadProject, syncTypes } from './project'
import { generateSettings, resolved, SETTINGS_ID } from './settings'

export type { Options } from './project'

async function sendOutput(response: ServerResponse, file: string): Promise<void> {
  try {
    const text = await readFile(file)

    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-cache')
    response.end(text)
  }
  catch {
    response.statusCode = 404
    response.end()
  }
}

export const unpluginFactory: UnpluginFactory<Options | undefined> = (options) => {
  let base = process.cwd()
  let local = false
  let serving = false
  let publicDir = ''

  const project = once(() => loadProject(base, options))

  return {
    name: 'unplugin-forgepress',

    vite: {
      configResolved(resolvedConfig) {
        base = resolvedConfig.root
        serving = resolvedConfig.command === 'serve'
        local = serving && options?.write !== false
        publicDir = resolvedConfig.publicDir ?? ''
      },

      async configureServer(server) {
        const { root, config, output } = await project()
        const { logger } = server.config

        const dev = createDevContent(root, config, {
          info: message => logger.info(message, { timestamp: true }),
          warn: message => logger.warn(message, { timestamp: true }),
          error: message => logger.error(message),
        }, () => server.ws.send({ type: 'full-reload' }))

        server.watcher.add(dev.watched)
        server.watcher.on('add', dev.changed)
        server.watcher.on('change', dev.changed)
        server.watcher.on('unlink', dev.changed)

        await dev.refresh()

        if (publicDir && isInside(publicDir, output)) {
          const prefix = `/${toPosix(relative(publicDir, output))}/`

          server.middlewares.use((request, response, next) => {
            const path = decodeURIComponent(request.url?.split('?')[0] ?? '')

            if ((request.method !== 'GET' && request.method !== 'HEAD') || !path.startsWith(prefix))
              return next()

            const file = join(output, path.slice(prefix.length))

            if (!isInside(output, file)) {
              response.statusCode = 404
              response.end()

              return
            }

            void sendOutput(response, file)
          })
        }

        if (options?.write !== false)
          server.middlewares.use(dev.endpoint)
      },
    },

    async buildStart() {
      const { root, config } = await project()

      syncTypes(root, config)

      if (serving)
        return

      await buildOutput(root, config)
    },

    resolveId(id) {
      if (id === SETTINGS_ID)
        return resolved(id)
    },

    async load(id) {
      if (id === resolved(SETTINGS_ID))
        return generateSettings(local, (await project()).config)
    },
  }
}

type Instance = UnpluginInstance<Options | undefined, boolean>

export const unplugin: Instance = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin

export const vitePlugin: Instance['vite'] = unplugin.vite
export const rollupPlugin: Instance['rollup'] = unplugin.rollup
export const rolldownPlugin: Instance['rolldown'] = unplugin.rolldown
export const webpackPlugin: Instance['webpack'] = unplugin.webpack
export const rspackPlugin: Instance['rspack'] = unplugin.rspack
export const farmPlugin: Instance['farm'] = unplugin.farm
export const bunPlugin: Instance['bun'] = unplugin.bun
