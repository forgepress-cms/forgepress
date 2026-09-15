import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import type { ResolvedConfig } from '../config/resolve'
import type { DevLogger } from './dev'
import type { OriginPolicy } from './endpoint'
import type { Options } from './project'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isMainThread, Worker } from 'node:worker_threads'
import { buildOutput, outputDir } from '../disk/output'
import { OUTPUT_VARIABLE } from '../disk/reader'
import { findRoot } from '../disk/root'
import { EVENTS } from '../files/paths'
import { errorMessage } from '../utils/error'
import { isRecord } from '../utils/value'
import { createDevContent } from './dev'
import { loadProjectConfig, syncTypes } from './project'
import { editorSettings, SETTINGS_ID } from './settings'

export interface NextOptions extends Options {
  preview?: boolean
}

export interface NextWebpackConfig {
  plugins?: unknown[]
  ignoreWarnings?: unknown[]
}

export interface NextWebpackContext {
  webpack: {
    NormalModuleReplacementPlugin: new (pattern: RegExp, request: string) => unknown
  }
}

export interface NextConfig {
  compiler?: {
    define?: Record<string, string | number | boolean>
    runAfterProductionCompile?: (metadata: { projectDir: string, distDir: string }) => Promise<void>
  }
  turbopack?: {
    resolveAlias?: Record<string, unknown>
  }
  webpack?: ((config: any, context: any) => any) | null
  instrumentationClientInject?: string[]
  typescript?: {
    tsconfigPath?: string
  }
}

export type NextConfigFunction<TConfig> = (phase: string, context: { defaultConfig: TConfig }) => TConfig | Promise<TConfig>

interface Project {
  root: string
  config: ResolvedConfig
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

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const RELOAD_FRAME = Buffer.concat([Buffer.from([0x81, 6]), Buffer.from('reload')])
const CLOSE_FRAME = Buffer.from([0x88, 0])
const CLOSE_OPCODE = 0x08

const SERVERS: unique symbol = Symbol.for('forgepress:next:servers')

const LOCAL_ORIGIN = /^https?:\/\/(?:(?:[^/:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/

const PREFLIGHT = {
  'access-control-allow-methods': 'GET, POST, DELETE',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '600',
}

const INCLUDE = /("include"\s*:\s*\[)([^\]]*)\]/g
const LAST_LINE_INDENT = /\n([ \t]*)\S[^\n]*$/

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

function servers(): Map<string, Promise<string>> {
  const scope = globalThis as { [SERVERS]?: Map<string, Promise<string>> }

  scope[SERVERS] ??= new Map()

  return scope[SERVERS]
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return undefined
  }
}

function addInclude(text: string, include: unknown[], pattern: string): string | undefined {
  const matches = [...text.matchAll(INCLUDE)]
  const [match] = matches
  const [whole = '', opening = '', inner = ''] = match ?? []

  if (!match || matches.length !== 1 || JSON.stringify(parse(`[${inner}]`)) !== JSON.stringify(include))
    return undefined

  const items = inner.trimEnd()
  const indent = LAST_LINE_INDENT.exec(items)?.[1]
  const entry = JSON.stringify(pattern)
  const added = !items.trim() ? entry : indent === undefined ? `${items}, ${entry}` : `${items},\n${indent}${entry}`

  return `${text.slice(0, match.index)}${opening}${added}${inner.slice(items.length)}]${text.slice(match.index + whole.length)}`
}

function includeContent(root: string, config: ResolvedConfig, tsconfig: string): void {
  const file = resolve(root, tsconfig)

  if (!existsSync(file))
    return

  const folder = relative(dirname(file), join(root, config.paths.dir)).split(sep).join('/')
  const pattern = `${folder}/**/*.ts`

  if (!folder.split('/').some(segment => segment.startsWith('.')))
    return

  const text = readFileSync(file, 'utf8')

  if (text.includes(JSON.stringify(pattern)))
    return

  const parsed = parse(text)
  const updated = isRecord(parsed) && Array.isArray(parsed.include) ? addInclude(text, parsed.include, pattern) : undefined

  if (updated === undefined) {
    logger.warn(`[forgepress] add ${JSON.stringify(pattern)} to "include" in ${basename(file)}, so TypeScript knows the schema`)

    return
  }

  writeFileSync(file, updated)
  logger.info(`[forgepress] added ${JSON.stringify(pattern)} to "include" in ${basename(file)}, so TypeScript knows the schema`)
}

function watchContent(dir: string, schema: string, changed: (file: string) => void): Promise<void> {
  const watcher = new Worker(WATCHER, { workerData: { dir, schema } })
  let watching = false

  watcher.unref()

  return new Promise((ready, fail) => {
    watcher.on('message', (file: string | null) => {
      if (file !== null)
        return changed(file)

      watching = true
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
  const sockets = new Set<Socket>()

  const dev = createDevContent(root, config, logger, () => {
    for (const socket of sockets)
      socket.write(RELOAD_FRAME)
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

  server.on('upgrade', (request, socket: Socket) => {
    const key = request.headers['sec-websocket-key']

    if (request.headers.host !== host || request.url !== EVENTS || typeof key !== 'string' || !LOCAL_PAGES.accepts(request)) {
      socket.destroy()

      return
    }

    const accept = createHash('sha1').update(`${key}${WEBSOCKET_GUID}`).digest('base64')

    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    sockets.add(socket)

    socket.on('data', (data: Buffer) => {
      if (((data[0] ?? 0) & 0x0F) === CLOSE_OPCODE)
        socket.end(CLOSE_FRAME)
    })

    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => sockets.delete(socket))
    socket.unref()
  })

  server.unref()

  return `http://${host}`
}

function devServer(root: string, config: ResolvedConfig, write: boolean): Promise<string> {
  const known = servers()
  const found = known.get(root) ?? startDevServer(root, config, write)

  known.set(root, found)

  return found
}

async function prepare(phase: string, next: NextConfig, options: NextOptions): Promise<Project> {
  const root = options.root ? resolve(options.root) : findRoot(process.cwd())
  const config = await loadProjectConfig(root, options)
  const serving = phase === DEVELOPMENT && isMainThread

  process.env[OUTPUT_VARIABLE] = outputDir(root, config)

  if (isMainThread && (phase === DEVELOPMENT || phase === BUILD)) {
    syncTypes(root, config)
    includeContent(root, config, next.typescript?.tsconfigPath ?? 'tsconfig.json')
  }

  return {
    root,
    config,
    local: phase === DEVELOPMENT && options.write !== false,
    server: serving ? await devServer(root, config, options.write !== false) : undefined,
  }
}

function extend<TConfig extends object>(found: TConfig, project: Project, options: NextOptions): TConfig {
  const next: NextConfig = found

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

    webpack: (config: NextWebpackConfig, context: NextWebpackContext): NextWebpackConfig => {
      const result: NextWebpackConfig = next.webpack ? next.webpack(config, context) : config

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

  return { ...found, ...extended }
}

export function withForgePress<TConfig extends object>(nextConfig: TConfig | NextConfigFunction<TConfig>, options: NextOptions = {}): (phase: string, context: { defaultConfig: TConfig }) => Promise<TConfig> {
  return async (phase, context) => {
    const found = typeof nextConfig === 'function' ? await (nextConfig as NextConfigFunction<TConfig>)(phase, context) : nextConfig

    return extend(found, await prepare(phase, found, options), options)
  }
}
