import type { ContentConfig } from '../../types/config/content'
import type { ContentRow } from '../../types/content/reader'
import type { ContentWriter } from '../../types/content/writer'
import type { ContentPaths } from '../paths'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readEntryIds } from '../entry/node'
import { defaultPaths } from '../paths'
import { serializeEntry, serializeSchema } from '../serialize'

export function createWriter(root: string, paths: ContentPaths = defaultPaths, config?: ContentConfig): ContentWriter {
  const directory = (collection: string): string => join(root, paths.collection(collection))
  const file = (collection: string, id: string): string => join(root, paths.entry(collection, id))

  async function write(collection: string, row: ContentRow): Promise<void> {
    await writeFile(file(collection, row.id), serializeEntry(collection, row, config))
  }

  return {
    async writeSchema(schema) {
      await mkdir(join(root, paths.dir), { recursive: true })
      await writeFile(join(root, paths.schema), serializeSchema(schema, config))
    },

    async writeEntry(collection, row) {
      await mkdir(directory(collection), { recursive: true })
      await write(collection, row)
    },

    async removeEntry(collection, id) {
      await rm(file(collection, id), { force: true })
    },

    async writeContent(collection, rows) {
      await mkdir(directory(collection), { recursive: true })

      const kept = new Set(rows.map(row => row.id))
      const stale = readEntryIds(directory(collection)).filter(id => !kept.has(id))

      await Promise.all(stale.map(id => rm(file(collection, id), { force: true })))
      await Promise.all(rows.map(row => write(collection, row)))
    },

    async removeCollection(collection) {
      await rm(directory(collection), { recursive: true, force: true })
    },

  }
}
