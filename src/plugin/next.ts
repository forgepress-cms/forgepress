import type { FormattingOptions, ParseError } from 'jsonc-parser'
import type { NextConfig } from 'next'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import type { ResolvedConfig } from '../config/resolve'
import type { DevLogger } from './dev'
import type { OriginPolicy } from './endpoint'
import type { Options, Project } from './project'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isMainThread, Worker } from 'node:worker_threads'
import { applyEdits, modify, parse } from 'jsonc-parser'
import { WebSocketServer } from 'ws'
import { editorSettings } from '../config/settings'
import { buildOutput } from '../disk/output'
import { toPosix } from '../disk/paths'
import { EVENTS } from '../endpoint/routes'
import { errorMessage } from '../utils/error'
import { keyed } from '../utils/once'
import { isRecord } from '../utils/value'
import { createDevContent } from './dev'
import { loadProject, syncTypes } from './project'
import { SETTINGS_ID } from './settings'

export interface NextOptions extends Options {
  preview?: boolean
}

export type NextConfigFunction = (phase: string, context: { defaultConfig: NextConfig }) => NextConfig | Promise<NextConfig>

interface WebpackConfig {
  plugins?: unknown[]
  ignoreWarnings?: unknown[]
}

interface NextProject extends Project {
  local: boolean
  server: string | undefined
}

const DEVELOPMENT = 'phase-development-server'
const BUILD = 'phase-production-build'

const SETTINGS_MODULE = 'forgepress/next/settings'
const SETTINGS_VARIABLE = '__FORGEPRESS_SETTINGS__'
const PREVIEW_MODULE = 'forgepress/next/preview'
const RELOAD_MODULE = 'forgepress/next/reload'

const VUE_FLAGS = {
  __VUE_OPTIONS_API__: true,
  __VUE_PROD_DEVTOOLS__: false,
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
}

const SERVERS: unique symbol = Symbol.for('forgepress:next:servers')

const LOCAL_ORIGIN = /^https?:\/\/(?:(?:[^/:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/

const PREFLIGHT = {
  'access-control-allow-methods': 'GET, POST, DELETE',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '600',
}

const INDENT = /^[ \t]+(?=\S)/m

const DIST = `${dirname(dirname(fileURLToPath(import.meta.url)))}${sep}`
const WATCHER = new URL(`./watcher${extname(fileURLToPath(import.meta.url))}`, import.meta.url)

function dynamicConfigImport(warning: { message?: string, module?: { resource?: string } }): boolean {
  return Boolean(warning.module?.resource?.startsWith(DIST) && warning.message?.includes('the request of a dependency is an expression'))
}

const logger: DevLogger = {
  info: message => process.stdout.write(`${message}\n`),
  warn: message => console.warn(message),
  error: message => console.error(message),
}

function localPage(request: IncomingMessage): boolean {
  const { origin } = request.headers
  const site = request.headers['sec-fetch-site']

  if (origin !== undefined)
    return LOCAL_ORIGIN.test(origin)

  return site === undefined || site === 'none' || site === 'same-origin'
}

const LOCAL_PAGES: OriginPolicy = {
  accepts: localPage,
  refusal: 'the dev endpoint only accepts requests from pages opened on localhost',
}

function end(response: ServerResponse, status: number, text?: string): void {
  response.statusCode = status
  response.end(text)
}

type Servers = (root: string, start: () => Promise<string>) => Promise<string>

function servers(): Servers {
  const scope = globalThis as { [SERVERS]?: Servers }

  scope[SERVERS] ??= keyed<string>()

  return scope[SERVERS]
}

function formatting(text: string): FormattingOptions {
  const indent = INDENT.exec(text)?.[0] ?? '  '

  return {
    insertSpaces: !indent.startsWith('\t'),
    tabSize: indent.length,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
  }
}

function includeContent(root: string, config: ResolvedConfig, tsconfig: string): void {
  const file = resolve(root, tsconfig)

  if (!existsSync(file))
    return

  const folder = toPosix(relative(dirname(file), join(root, config.paths.dir)))
  const pattern = `${folder}/**/*.ts`

  if (!folder.split('/').some(segment => segment.startsWith('.')))
    return

  const text = readFileSync(file, 'utf8')
  const errors: ParseError[] = []
  const parsed: unknown = parse(text, errors, { allowTrailingComma: true })

  if (errors.length > 0 || !isRecord(parsed) || !Array.isArray(parsed.include)) {
    logger.warn(`[forgepress] add ${JSON.stringify(pattern)} to "include" in ${basename(file)}, so TypeScript knows the schema`)

    return
  }

  if (parsed.include.includes(pattern))
    return

  writeFileSync(file, applyEdits(text, modify(text, ['include', parsed.include.length], pattern, { isArrayInsertion: true, formattingOptions: formatting(text) })))
  logger.info(`[forgepress] added ${JSON.stringify(pattern)} to "include" in ${basename(file)}, so TypeScript knows the schema`)
}

function watchContent(dir: string, schema: string, changed: (file: string) => void): Promise<void> {
  const watcher = new Worker(WATCHER, { workerData: { dir, schema } })
  let watching = false

  return new Promise((ready, fail) => {
    watcher.on('message', (file: string | null) => {
      if (file !== null)
        return changed(file)

      watching = true
      watcher.unref()
      ready()
    })

    watcher.on('error', (error) => {
      if (watching)
        logger.error(`[forgepress] stopped watching the content folder: ${errorMessage(error)}`)
      else
        fail(error)
    })
  })
}

function listen(server: Server): Promise<string> {
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => done(`127.0.0.1:${(server.address() as AddressInfo).port}`))
  })
}

async function startDevServer(root: string, config: ResolvedConfig, write: boolean): Promise<string> {
  const pages = new WebSocketServer({ noServer: true })

  const dev = createDevContent(root, config, logger, () => {
    for (const page of pages.clients)
      page.send('reload')
  }, LOCAL_PAGES)

  await watchContent(join(root, config.paths.dir), join(root, config.paths.schema), dev.changed)
  await dev.refresh()

  const server = createServer()
  const host = await listen(server)

  server.on('request', (request, response) => {
    const { origin } = request.headers

    if (request.headers.host !== host)
      return end(response, 403)

    if (origin !== undefined) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('vary', 'origin')
    }

    if (request.method === 'OPTIONS') {
      if (!LOCAL_PAGES.accepts(request))
        return end(response, 403, LOCAL_PAGES.refusal)

      for (const [name, value] of Object.entries(PREFLIGHT))
        response.setHeader(name, value)

      return end(response, 204)
    }

    if (!write)
      return end(response, 404)

    dev.endpoint(request, response, () => end(response, 404))
  })

  server.on('upgrade', (request, socket: Socket, head) => {
    if (request.headers.host !== host || request.url !== EVENTS || !LOCAL_PAGES.accepts(request)) {
      socket.destroy()

      return
    }

    socket.unref()
    pages.handleUpgrade(request, socket, head, page => page.on('error', () => page.terminate()))
  })

  server.unref()

  return `http://${host}`
}

function devServer(root: string, config: ResolvedConfig, write: boolean): Promise<string> {
  return servers()(root, () => startDevServer(root, config, write))
}

async function prepare(phase: string, next: NextConfig, options: NextOptions): Promise<NextProject> {
  const project = await loadProject(process.cwd(), options)
  const { root, config } = project
  const serving = phase === DEVELOPMENT && isMainThread

  if (isMainThread && (phase === DEVELOPMENT || phase === BUILD)) {
    syncTypes(root, config)
    includeContent(root, config, next.typescript?.tsconfigPath ?? 'tsconfig.json')
  }

  return {
    ...project,
    local: phase === DEVELOPMENT && options.write !== false,
    server: serving ? await devServer(root, config, options.write !== false) : undefined,
  }
}

function extend(next: NextConfig, project: NextProject, options: NextOptions): NextConfig {
  const extended: NextConfig = {
    compiler: {
      ...next.compiler,
      define: {
        ...VUE_FLAGS,
        ...next.compiler?.define,
        [SETTINGS_VARIABLE]: JSON.stringify(editorSettings(project.local, project.config, project.server)),
      },
      runAfterProductionCompile: async (metadata) => {
        await buildOutput(project.root, project.config)
        await next.compiler?.runAfterProductionCompile?.(metadata)
      },
    },

    turbopack: {
      ...next.turbopack,
      resolveAlias: { ...next.turbopack?.resolveAlias, [SETTINGS_ID]: SETTINGS_MODULE },
    },

    webpack: (config: WebpackConfig, context): WebpackConfig => {
      const result: WebpackConfig = next.webpack ? next.webpack(config, context) : config

      result.plugins = [...result.plugins ?? [], new context.webpack.NormalModuleReplacementPlugin(/^virtual:forgepress\/settings$/, SETTINGS_MODULE)]
      result.ignoreWarnings = [...result.ignoreWarnings ?? [], dynamicConfigImport]

      return result
    },

    instrumentationClientInject: [
      ...next.instrumentationClientInject ?? [],
      ...options.preview === false ? [] : [PREVIEW_MODULE],
      ...project.server ? [RELOAD_MODULE] : [],
    ],
  }

  return { ...next, ...extended }
}

export function withForgePress(nextConfig: NextConfig | NextConfigFunction, options: NextOptions = {}): (phase: string, context: { defaultConfig: NextConfig }) => Promise<NextConfig> {
  return async (phase, context) => {
    const found = typeof nextConfig === 'function' ? await nextConfig(phase, context) : nextConfig

    return extend(found, await prepare(phase, found, options), options)
  }
}
