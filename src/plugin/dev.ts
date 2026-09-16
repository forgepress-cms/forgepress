import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config/resolve'
import type { ContentIssue } from '../files/issues'
import type { OriginPolicy } from './endpoint'
import { join, sep } from 'node:path'
import { debounce } from 'perfect-debounce'
import { buildOutput } from '../disk/output'
import { ENDPOINT } from '../endpoint/routes'
import { ContentError } from '../files/issues'
import { errorMessage } from '../utils/error'
import { EndpointError, handle, SAME_ORIGIN } from './endpoint'
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

  let reported = ''

  function report(issues: readonly ContentIssue[]): void {
    const message = issues.length > 0 ? new ContentError(issues).message : ''

    if (message === reported)
      return

    if (message)
      logger.warn(`${message}\n[forgepress] the build fails until ${issues.length === 1 ? 'this problem is' : 'these problems are'} fixed`)
    else
      logger.info('[forgepress] content problems are fixed')

    reported = message
  }

  async function write(): Promise<void> {
    syncTypes(root, config)

    try {
      report((await buildOutput(root, config, { dev: true })).issues)
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

      handle(config, root, request, response, origins)
        .then(() => {
          if (method !== 'GET')
            void rebuild(reload)
        })
        .catch((error: unknown) => {
          response.statusCode = error instanceof EndpointError ? error.status : 500
          response.end(errorMessage(error))
        })
    },
  }
}
