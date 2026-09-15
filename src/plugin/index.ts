import type { ServerResponse } from 'node:http'
import type { UnpluginFactory } from 'unplugin'
import type { ResolvedConfig } from '../config/resolve'
import type { Options } from './project'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve as resolvePath, sep } from 'node:path'
import process from 'node:process'
import { createUnplugin } from 'unplugin'
import { buildOutput, outputDir } from '../disk/output'
import { OUTPUT_VARIABLE } from '../disk/reader'
import { findRoot } from '../disk/root'
import { createDevContent } from './dev'
import { loadProjectConfig, syncTypes } from './project'
import { generateSettings, resolved, SETTINGS_ID } from './settings'

export type { Options } from './project'

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child)

  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

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
  let root = options?.root ? resolvePath(options.root) : findRoot(process.cwd())
  let local = false
  let serving = false
  let publicDir = ''

  let config: Promise<ResolvedConfig> | undefined

  function resolve(): Promise<ResolvedConfig> {
    config ??= loadProjectConfig(root, options)

    return config
  }

  return {
    name: 'unplugin-forgepress',

    vite: {
      configResolved(resolvedConfig) {
        root = options?.root ? resolvePath(resolvedConfig.root, options.root) : findRoot(resolvedConfig.root)
        serving = resolvedConfig.command === 'serve'
        local = serving && options?.write !== false
        publicDir = resolvedConfig.publicDir ?? ''
      },

      async configureServer(server) {
        const current = await resolve()
        const { logger } = server.config
        const output = outputDir(root, current)

        const dev = createDevContent(root, current, {
          info: message => logger.info(message, { timestamp: true }),
          warn: message => logger.warn(message, { timestamp: true }),
          error: message => logger.error(message),
        }, () => server.ws.send({ type: 'full-reload' }))

        process.env[OUTPUT_VARIABLE] = output

        server.watcher.add(dev.watched)
        server.watcher.on('add', dev.changed)
        server.watcher.on('change', dev.changed)
        server.watcher.on('unlink', dev.changed)

        await dev.refresh()

        if (publicDir && inside(publicDir, output)) {
          const prefix = `/${relative(publicDir, output).split(sep).join('/')}/`

          server.middlewares.use((request, response, next) => {
            const path = decodeURIComponent(request.url?.split('?')[0] ?? '')

            if ((request.method !== 'GET' && request.method !== 'HEAD') || !path.startsWith(prefix))
              return next()

            const file = join(output, path.slice(prefix.length))

            if (!inside(output, file)) {
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
      const current = await resolve()

      syncTypes(root, current)

      if (serving)
        return

      process.env[OUTPUT_VARIABLE] = outputDir(root, current)
      await buildOutput(root, current)
    },

    resolveId(id) {
      if (id === SETTINGS_ID)
        return resolved(id)
    },

    async load(id) {
      if (id === resolved(SETTINGS_ID))
        return generateSettings(local, await resolve())
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
export const farmPlugin = unplugin.farm
export const bunPlugin = unplugin.bun
