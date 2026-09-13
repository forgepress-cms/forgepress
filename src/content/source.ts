/// <reference path="../types/query/virtual.d.ts" />
import type { ContentConfig } from '../types/config/content'
import type { ProviderConfig } from '../types/config/provider'
import type { BakedMedia } from '../types/content/media'
import type { ContentRow, ContentSource } from '../types/content/reader'
import type { ContentPaths } from './paths'
import { toMeta } from './entry/meta'
import { sortByCreation } from './entry/order'
import { createPaths } from './paths'

export interface BakedSettings {
  local: boolean
  media: BakedMedia
  provider: ProviderConfig | undefined
  format: ContentConfig | undefined
  paths: ContentPaths
}

let bundle: Promise<typeof import('virtual:forgepress/content')> | undefined
let settings: Promise<BakedSettings> | undefined

function loadBundle(): Promise<typeof import('virtual:forgepress/content')> {
  bundle ??= import('virtual:forgepress/content')

  return bundle
}

export function baked(): Promise<BakedSettings> {
  settings ??= loadBundle().then(module => ({
    local: module.local === true,
    media: module.media,
    provider: module.provider ?? undefined,
    format: module.format ?? undefined,
    paths: createPaths(module.contentPath),
  }))

  return settings
}

async function list(collection: string): Promise<ContentRow[]> {
  const loaders = (await loadBundle()).content[collection]

  return loaders ? sortByCreation((await loaders.list()).default) : []
}

export const source: ContentSource = {
  schema: async () => (await loadBundle()).schema,

  list,

  index: async collection => (await list(collection)).map(toMeta),

  entry: async (collection, id) => {
    const load = (await loadBundle()).content[collection]?.entry[id]

    return load ? (await load()).default : undefined
  },
}
