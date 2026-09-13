import type { ContentRow, ContentSource } from '../../types/content/reader'
import type { ForgePressSchema } from '../../types/core/schema'
import type { ContentPaths } from '../paths'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { toMeta } from '../entry/meta'
import { readEntryIds } from '../entry/node'
import { sortByCreation } from '../entry/order'
import { defaultPaths } from '../paths'
import { findRoot } from '../root'
import { source as bundle } from '../source'

async function importModule<TModule>(file: string): Promise<TModule> {
  return await import(/* @vite-ignore */ pathToFileURL(file).href) as TModule
}

export function createSource(start?: string, paths: ContentPaths = defaultPaths): ContentSource {
  const rows = new Map<string, Promise<ContentRow[]>>()
  let root: string | undefined
  let schema: Promise<ForgePressSchema> | undefined

  const resolve = (): string => (root ??= findRoot(start, paths.dir))

  function file(collection: string, id: string): string {
    return join(resolve(), paths.entry(collection, id))
  }

  async function load(collection: string): Promise<ContentRow[]> {
    const ids = readEntryIds(join(resolve(), paths.collection(collection)))
    const entries = await Promise.all(ids.map(id => importModule<{ default: ContentRow }>(file(collection, id))))

    return sortByCreation(entries.map(entry => entry.default))
  }

  function all(collection: string): Promise<ContentRow[]> {
    let pending = rows.get(collection)

    if (!pending) {
      pending = load(collection)
      rows.set(collection, pending)
    }

    return pending
  }

  return {
    schema: () => (schema ??= importModule<{ default: ForgePressSchema }>(join(resolve(), paths.schema)).then(module => module.default)),

    list: all,

    index: async collection => (await all(collection)).map(toMeta),

    entry: async (collection, id) => {
      const path = file(collection, id)

      if (!existsSync(path))
        return undefined

      return (await importModule<{ default: ContentRow }>(path)).default
    },
  }
}

const disk = createSource()
let active: Promise<ContentSource> | undefined

function select(): Promise<ContentSource> {
  active ??= bundle.schema().then(() => bundle, () => disk)

  return active
}

export const source: ContentSource = {
  schema: async () => (await select()).schema(),
  list: async collection => (await select()).list(collection),
  index: async collection => (await select()).index(collection),
  entry: async (collection, id) => (await select()).entry(collection, id),
}
