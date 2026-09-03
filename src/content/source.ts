/// <reference path="../types/query/virtual.d.ts" />
import type { ContentConfig } from '../types/config/content'
import type { ProviderConfig } from '../types/config/provider'
import type { BakedMedia } from '../types/content/media'
import type { ContentReader, ContentSource } from '../types/content/reader'

let bundle: Promise<typeof import('virtual:webenv/content')> | undefined

function loadBundle(): Promise<typeof import('virtual:webenv/content')> {
  bundle ??= import('virtual:webenv/content')
  return bundle
}

export async function isLocal(): Promise<boolean> {
  return (await loadBundle()).local === true
}

export async function bakedMedia(): Promise<BakedMedia> {
  return (await loadBundle()).media
}

export async function bakedProvider(): Promise<ProviderConfig | null> {
  return (await loadBundle()).provider
}

export async function bakedFormat(): Promise<ContentConfig | null> {
  return (await loadBundle()).format
}

export const source: ContentSource = {
  schema: async () => (await loadBundle()).schema,
  list: async (component) => {
    const { content } = await loadBundle()
    return (await content[component]?.())?.default ?? []
  },
}

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
