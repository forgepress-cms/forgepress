import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config/resolve'
import type { ContentIssue } from '../files/issues'
import type { OriginPolicy } from './endpoint'
import { join, sep } from 'node:path'
import { debounce } from 'perfect-debounce'
import { buildOutput } from '../disk/output'
import { createWriter } from '../disk/writer'
import { ENDPOINT } from '../endpoint/routes'
import { ContentError } from '../files/issues'
import { errorMessage } from '../utils/error'
import { EndpointError, handle, SAME_ORIGIN } from './endpoint'
import { createMigrations } from './migrations'
import { syncTypes } from './project'

export interface DevLogger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

export type Middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => void

export interface DevContent {
  watched: string[]
  changed: (file: string) => void
  refresh: () => Promise<void>
  endpoint: Middleware
}

export function createDevContent(root: string, config: ResolvedConfig, logger: DevLogger, reload: () => void, origins: OriginPolicy = SAME_ORIGIN): DevContent {
  const schemaFile = join(root, config.paths.schema)
  const contentDir = join(root, config.paths.content)

  const migrations = createMigrations(createWriter(root, config.paths, config.content))

  let reported = ''
  let latest: readonly ContentIssue[] = []

  function report(issues: readonly ContentIssue[]): void {
    const message = issues.length > 0 ? new ContentError(issues).message : ''

    latest = issues

    if (message === reported)
      return

    const hint = migrations.state().outstanding ? '; after changing schema.ts by hand, the Schema page of the editor or `forgepress migrate` migrates the content' : ''

    if (message)
      logger.warn(`${message}\n[forgepress] the build fails until ${issues.length === 1 ? 'this problem is' : 'these problems are'} fixed${hint}`)
    else
      logger.info('[forgepress] content problems are fixed')

    reported = message
  }

  async function write(): Promise<void> {
    syncTypes(root, config)

    try {
      const { issues, schema } = await buildOutput(root, config, { dev: true })

      if (schema)
        migrations.observe(schema)

      report(issues)
    }
    catch (error) {
      if (!(error instanceof ContentError))
        throw error

      report(error.issues)
    }
  }

  const rebuild = debounce(async (after?: () => void) => {
    await write().catch((error: unknown) => logger.error(`[forgepress] could not write the content output: ${errorMessage(error)}`))
    after?.()
  }, 100)

  return {
    watched: [schemaFile, contentDir],

    changed: (file) => {
      if (file === schemaFile || file.startsWith(`${contentDir}${sep}`))
        void rebuild(reload)
    },

    refresh: () => rebuild(),

    endpoint: (request, response, next) => {
      const method = request.method ?? ''
      const handled = method === 'POST' || method === 'DELETE' || method === 'GET'

      if (!handled || !request.url?.startsWith(`${ENDPOINT}/`))
        return next()

      handle(config, root, request, response, { migrations, issues: () => latest }, origins)
        .then((changed) => {
          if (changed)
            void rebuild(reload)
        })
        .catch((error: unknown) => {
          response.statusCode = error instanceof EndpointError ? error.status : 500
          response.end(errorMessage(error))
        })
    },
  }
}
