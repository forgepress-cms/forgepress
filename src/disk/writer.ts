import type { ContentConfig } from '../config/types'
import type { ContentPaths } from '../files/paths'
import type { ContentWriter, SchemaWriter } from '../store/types'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultPaths, isCollectionName, isEntryFile, isEntryId, toEntryId } from '../files/paths'
import { serializeEntry, serializeSchema } from '../files/serialize'
import { listFiles } from './files'

function collectionName(collection: string): string {
  if (!isCollectionName(collection))
    throw new Error(`[forgepress] ${JSON.stringify(collection)} is not a collection name`)

  return collection
}

function entryId(id: string): string {
  if (typeof id !== 'string' || !isEntryId(id))
    throw new Error(`[forgepress] ${JSON.stringify(id)} is not an entry id`)

  return id
}

export function createWriter(root: string, paths: ContentPaths = defaultPaths, config?: ContentConfig): ContentWriter & SchemaWriter {
  const directory = (collection: string): string => join(root, paths.collection(collectionName(collection)))
  const file = (collection: string, id: string): string => join(root, paths.entry(collectionName(collection), entryId(id)))

  return {
    async writeSchema(schema) {
      await mkdir(join(root, paths.dir), { recursive: true })
      await writeFile(join(root, paths.schema), serializeSchema(schema, config))
    },

    async writeEntry(collection, row) {
      const target = file(collection, row.id)

      await mkdir(directory(collection), { recursive: true })
      await writeFile(target, serializeEntry(collection, row, config))
    },

    async removeEntry(collection, id) {
      await rm(file(collection, id), { force: true })
    },

    async writeContent(collection, rows) {
      const targets = rows.map(row => [file(collection, row.id), serializeEntry(collection, row, config)] as const)
      const kept = new Set(rows.map(row => row.id))

      await mkdir(directory(collection), { recursive: true })

      const stale = (await listFiles(directory(collection))).filter(isEntryFile).map(toEntryId).filter(id => !kept.has(id))

      await Promise.all(stale.map(id => rm(file(collection, id), { force: true })))
      await Promise.all(targets.map(([target, text]) => writeFile(target, text)))
    },

    async removeCollection(collection) {
      await rm(directory(collection), { recursive: true, force: true })
    },
  }
}
