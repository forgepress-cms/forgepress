import type { ContentRow, ContentSource } from '../../types/content/reader'
import type { ForgePressSchema } from '../../types/core/schema'
import type { ContentPaths } from '../paths'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { toMeta } from '../entry/meta'
import { readEntryIds } from '../entry/node'
import { sortByCreation } from '../entry/order'
import { parseEntry, parseSchema } from '../parse'
import { defaultPaths } from '../paths'
import { findRoot } from '../root'
import { source as bundle } from '../source'

export function createSource(start?: string, paths: ContentPaths = defaultPaths): ContentSource {
  const rows = new Map<string, Promise<ContentRow[]>>()
  let root: string | undefined
  let schema: Promise<ForgePressSchema> | undefined

  const resolve = (): string => (root ??= findRoot(start, paths.dir))

  async function read(collection: string, id: string): Promise<ContentRow> {
    const file = paths.entry(collection, id)

    return parseEntry(await readFile(join(resolve(), file), 'utf8'), file)
  }

  async function load(collection: string): Promise<ContentRow[]> {
    const ids = readEntryIds(join(resolve(), paths.collection(collection)))

    return sortByCreation(await Promise.all(ids.map(id => read(collection, id))))
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
    schema: () => (schema ??= readFile(join(resolve(), paths.schema), 'utf8').then(text => parseSchema(text, paths.schema))),

    list: all,

    index: async collection => (await all(collection)).map(toMeta),

    entry: async (collection, id) => {
      if (!existsSync(join(resolve(), paths.entry(collection, id))))
        return undefined

      return read(collection, id)
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
