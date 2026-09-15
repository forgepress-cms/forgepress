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

  async function readSchema(): Promise<ForgePressSchema> {
    const file = join(resolve(), paths.schema)

    return existsSync(file) ? parseSchema(await readFile(file, 'utf8'), paths.schema) : { collections: {} }
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
    schema: () => (schema ??= readSchema()),

    list: all,

    entry: async (collection, id) => {
      if (!existsSync(join(resolve(), paths.entry(collection, id))))
        return undefined

      const row = await read(collection, id)

      return visible(row) ? row : undefined
    },
  }
}
