import type { ContentPaths } from '../files/paths'
import type { ContentSource } from '../store/types'
import type { Entry } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sortByCreation } from '../entries/order'
import { parseEntry, parseSchema } from '../files/parse'
import { defaultPaths } from '../files/paths'
import { source as bundle } from '../store/bundle'
import { readEntryIds } from './collections'
import { findRoot } from './root'

export interface SourceOptions {
  unpublished?: boolean
}

export function createSource(start?: string, paths: ContentPaths = defaultPaths, options: SourceOptions = {}): ContentSource {
  const rows = new Map<string, Promise<Entry[]>>()
  let root: string | undefined
  let schema: Promise<ForgePressSchema> | undefined

  const resolve = (): string => (root ??= findRoot(start, paths.dir))
  const visible = (row: Entry): boolean => options.unpublished === true || row.status === 'published'

  async function read(collection: string, id: string): Promise<Entry> {
    const file = paths.entry(collection, id)

    return parseEntry(await readFile(join(resolve(), file), 'utf8'), file)
  }

  async function load(collection: string): Promise<Entry[]> {
    const ids = readEntryIds(join(resolve(), paths.collection(collection)))

    return sortByCreation((await Promise.all(ids.map(id => read(collection, id)))).filter(visible))
  }

  function all(collection: string): Promise<Entry[]> {
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

    entry: async (collection, id) => {
      if (!existsSync(join(resolve(), paths.entry(collection, id))))
        return undefined

      const row = await read(collection, id)

      return visible(row) ? row : undefined
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
  entry: async (collection, id) => (await select()).entry(collection, id),
}
