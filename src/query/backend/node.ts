/// <reference path="../../types/query/virtual.d.ts" />
import type { WebenvSchema } from '../../types/core/schema'
import type { QueryBackend } from '../../types/query'
import type { ContentLoader, ContentRow } from '../../types/query/loader'

interface Source { schema: WebenvSchema, content: Record<string, ContentRow[]> }

let source: Promise<Source> | undefined

/**
 * Resolves the content compiled by the webenv plugin from the local `.webenv`
 * directory. Loaded once and cached for the lifetime of the process.
 */
function load(): Promise<Source> {
  source ??= import('virtual:webenv/content').then(mod => ({ schema: mod.schema, content: mod.content }))
  return source
}

const loader: ContentLoader = {
  async list(component) {
    const { content } = await load()
    return content[component] ?? []
  },
  async get(component, id) {
    const { content } = await load()
    return content[component]?.find(row => row.id === id)
  },
}

export const nodeBackend: QueryBackend = {
  loader,
  schema: async () => (await load()).schema,
}
