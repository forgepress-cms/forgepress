/// <reference path="../types/query/virtual.d.ts" />
import type { ContentReader, ContentSource } from '../types/content/reader'

let bundle: Promise<typeof import('virtual:webenv/content')> | undefined

function loadBundle(): Promise<typeof import('virtual:webenv/content')> {
  bundle ??= import('virtual:webenv/content')
  return bundle
}

/** Reads the content the webenv plugin compiled into the build, one component chunk at a time. */
export const source: ContentSource = {
  schema: async () => (await loadBundle()).schema,
  list: async (component) => {
    const { content } = await loadBundle()
    return (await content[component]?.())?.default ?? []
  },
}

/** Adds row lookup on top of any source, so a backend only has to implement listing. */
export function createReader(source: ContentSource): ContentReader {
  return {
    schema: source.schema,
    list: source.list,
    async get(component, id) {
      return (await source.list(component)).find(row => row.id === id)
    },
  }
}

export const reader = createReader(source)
