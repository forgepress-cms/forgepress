/// <reference path="./virtual.d.ts" />
import type { ContentPaths } from '../files/paths'
import type { BakedMedia } from '../media/types'
import type { ContentConfig, ProviderConfig } from '../types/config'
import type { ContentRow } from '../types/entry'
import type { ContentSource } from './types'
import { sortByCreation } from '../entries/order'
import { createPaths } from '../files/paths'

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

  entry: async (collection, id) => {
    const load = (await loadBundle()).content[collection]?.entry[id]

    return load ? (await load()).default : undefined
  },
}
