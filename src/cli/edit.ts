import type { FSWatcher } from 'node:fs'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config/resolve'
import type { ContentIssue } from '../files/issues'
import { createReadStream, existsSync, watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { debounce } from 'perfect-debounce'
import { editorSettings } from '../config/settings'
import { diskFiles } from '../disk/files'
import { createWriter } from '../disk/writer'
import { ENDPOINT } from '../endpoint/routes'
import { readContent } from '../files/content'
import { mediaType } from '../media'
import { EndpointError, handle } from '../plugin/endpoint'
import { createMigrations } from '../plugin/migrations'
import { syncTypes } from '../plugin/project'
import { errorMessage } from '../utils/error'

export const DEFAULT_PORT = 4390

const ASSETS = '/@forgepress'
const BUNDLES = [new URL('../editor/', import.meta.url), new URL('../../dist/editor/', import.meta.url)]

export interface EditOptions {
  port?: number | undefined
  fixed?: boolean
  assets?: string
  log: (message: string) => void
}

export interface Editor {
  url: string
  close: () => Promise<void>
}

function PAGE(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>${title}</title>
    <script>window.process = { env: { NODE_ENV: 'production' } }</script>
    <script type="importmap">{"imports":{"vue":"${ASSETS}/vue.mjs","virtual:forgepress/settings":"${ASSETS}/settings.mjs"}}</script>
  </head>

  <body>
    <div id="forgepress"></div>
    <script type="module">
    import { mountEditor } from '${ASSETS}/editor.mjs'

    mountEditor()
    new EventSource('${ASSETS}/reload').onmessage = () => location.reload()
    </script>
  </body>
</html>
`
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  response.end(body)
}

async function file(response: ServerResponse, path: string, type: string): Promise<boolean> {
  const found = await stat(path).catch(() => undefined)

  if (!found?.isFile())
    return false

  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'content-length': String(found.size) })
  createReadStream(path).pipe(response)

  return true
}

function within(directory: string, path: string): string | undefined {
  const target = normalize(join(directory, path))

  return target === directory || target.startsWith(`${directory}${sep}`) ? target : undefined
}

function watchProject(root: string, config: ResolvedConfig, changed: () => void): { close: () => void } {
  const dir = join(root, config.paths.dir)
  const schema = join(root, config.paths.schema)
  const content = join(root, config.paths.content)

  let watcher: FSWatcher | undefined
  let parent: FSWatcher | undefined

  function start(): boolean {
    if (!existsSync(dir))
      return false

    watcher = watch(dir, { recursive: true }, (_, name) => {
      const file = name === null ? '' : join(dir, name.toString())

      if (file === schema || file.startsWith(`${content}${sep}`))
        changed()
    })

    return true
  }

  if (!start()) {
    parent = watch(root, () => {
      if (watcher || !start())
        return

      parent?.close()
      changed()
    })
  }

  return {
    close: () => {
      watcher?.close()
      parent?.close()
    },
  }
}

function bundle(chosen?: string): string {
  const paths = chosen === undefined ? BUNDLES.map(url => fileURLToPath(url)) : [chosen]
  const found = paths.find(path => existsSync(join(path, 'index.mjs')))

  if (found === undefined)
    throw new Error(`[forgepress] the editor was not found at ${paths[0]!}, so the package has to be built`)

  return found
}

export async function edit(root: string, config: ResolvedConfig, options: EditOptions): Promise<Editor> {
  const assets = bundle(options.assets)

  const migrations = createMigrations(createWriter(root, config.paths, config.content))
  const settings = `export default ${JSON.stringify(editorSettings(true, config))}\n`
  const media = join(root, config.media.dir)
  const clients = new Set<ServerResponse>()

  let issues: readonly ContentIssue[] = []

  async function read(): Promise<void> {
    const parsed = await readContent(diskFiles(root), config.paths)

    issues = parsed.issues

    if (parsed.schema)
      migrations.observe(parsed.schema)
  }

  function reload(): void {
    for (const client of clients)
      client.write('data: reload\n\n')
  }

  const refresh = debounce(async (after?: () => void) => {
    syncTypes(root, config)
    await read().catch((error: unknown) => options.log(`[forgepress] ${errorMessage(error)}`))
    after?.()
  }, 100)

  async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = (request.url ?? '/').split('?')[0] ?? '/'

    if (path.startsWith(`${ENDPOINT}/`)) {
      const changed = await handle(config, root, request, response, { migrations, issues: () => issues })

      if (changed)
        void refresh(reload)

      return
    }

    if (path === `${ASSETS}/reload`) {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'connection': 'keep-alive' })
      response.write(': ready\n\n')
      clients.add(response)
      request.on('close', () => clients.delete(response))

      return
    }

    if (path === `${ASSETS}/settings.mjs`)
      return send(response, 200, 'text/javascript', settings)

    if (path === `${ASSETS}/editor.mjs` || path === `${ASSETS}/vue.mjs`) {
      const name = path === `${ASSETS}/vue.mjs` ? 'vue.mjs' : 'index.mjs'

      if (await file(response, join(assets, name), 'text/javascript'))
        return
    }

    if (path.startsWith(`${config.media.url}/`)) {
      const target = within(media, decodeURIComponent(path.slice(config.media.url.length)))

      if (target && await file(response, target, mediaType(target) || 'application/octet-stream'))
        return
    }

    if (request.method === 'GET' && !path.startsWith(`${ASSETS}/`))
      return send(response, 200, 'text/html; charset=utf-8', PAGE('ForgePress'))

    send(response, 404, 'text/plain', `${path} is not served by forgepress edit`)
  }

  const server = createServer((request, response) => {
    serve(request, response).catch((error: unknown) => {
      if (response.headersSent)
        return response.end()

      send(response, error instanceof EndpointError ? error.status : 500, 'text/plain', errorMessage(error))
    })
  })

  const watcher = watchProject(root, config, () => void refresh(reload))

  await refresh()

  const port = await listen(server, options.port ?? DEFAULT_PORT, options.fixed === true)

  return {
    url: `http://localhost:${port}`,

    close: async () => {
      watcher.close()

      for (const client of clients)
        client.end()

      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}

function listen(server: Server, port: number, fixed: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = port

    const start = (): void => {
      server.listen(attempt, '127.0.0.1')
    }

    server.on('listening', () => {
      const address = server.address()

      resolve(typeof address === 'object' && address ? address.port : attempt)
    })

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EADDRINUSE' || fixed || attempt - port >= 10)
        return reject(error)

      attempt += 1
      start()
    })

    start()
  })
}
