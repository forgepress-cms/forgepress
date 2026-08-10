/// <reference path="../../types/query/virtual.d.ts" />
import type { ContentReader, ContentRow } from '../../types/content/reader'
import type { WebenvSchema } from '../../types/core/schema'

interface Source { schema: WebenvSchema, content: Record<string, ContentRow[]> }

let source: Promise<Source> | undefined

/**
 * Resolves the content compiled by the webenv plugin from the local `.webenv`
 * directory. Loaded once and cached for the lifetime of the process.
 */
export async function load(): Promise<Source> {
  source ??= import('virtual:webenv/content').then(mod => ({ schema: mod.schema, content: mod.content }))
  return source
}

export const reader: ContentReader = {
  async list(component) {
    const { content } = await load()
    return content[component] ?? []
  },
  async get(component, id) {
    const { content } = await load()
    return content[component]?.find(row => row.id === id)
  },
}
