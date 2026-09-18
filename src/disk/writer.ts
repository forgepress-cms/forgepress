import type { ContentConfig } from '../config/types'
import type { ContentPaths } from '../files/paths'
import type { ContentWriter, SchemaChangeset } from '../store/types'
import { mkdir, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseSchemaFile } from '../files/parse'
import { defaultPaths, isCollectionName, isEntryFile, isEntryId } from '../files/paths'
import { serializeEntry, serializeSchema } from '../files/serialize'
import { same } from '../utils/value'
import { listFiles, readText } from './files'

interface WrittenFile {
  path: string
  after: string | undefined
}

export interface DiskWriter extends ContentWriter {
  apply: (changeset: SchemaChangeset) => Promise<string[]>
}

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

async function removeEmpty(folder: string): Promise<void> {
  try {
    await rmdir(folder)
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (code !== 'ENOTEMPTY' && code !== 'EEXIST' && code !== 'ENOENT')
      throw error
  }
}

export function createWriter(root: string, paths: ContentPaths = defaultPaths, config?: ContentConfig): DiskWriter {
  const directory = (collection: string): string => join(root, paths.collection(collectionName(collection)))
  const file = (collection: string, id: string): string => join(root, paths.entry(collectionName(collection), entryId(id)))

  async function place(files: readonly WrittenFile[]): Promise<void> {
    const ordered = [...files.filter(item => item.path !== paths.schema), ...files.filter(item => item.path === paths.schema)]

    for (const item of ordered) {
      const target = join(root, item.path)

      if (item.after === undefined) {
        await rm(target, { force: true })
        await removeEmpty(dirname(target))
      }
      else {
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, item.after)
      }
    }
  }

  return {
    async writeEntry(collection, row) {
      const target = file(collection, row.id)

      await mkdir(directory(collection), { recursive: true })
      await writeFile(target, serializeEntry(collection, row, config))
    },

    async removeEntry(collection, id) {
      await rm(file(collection, id), { force: true })
    },

    async apply(changeset) {
      const texts = new Map<string, string | undefined>()

      for (const collection of changeset.collections) {
        const folder = paths.collection(collectionName(collection))

        for (const name of (await listFiles(join(root, folder))).filter(isEntryFile))
          texts.set(`${folder}/${name}`, undefined)
      }

      for (const { collection, entry } of changeset.write)
        texts.set(paths.entry(collectionName(collection), entryId(entry.id)), serializeEntry(collection, entry, config))

      const schema = await readText(join(root, paths.schema))
      const parsed = schema === undefined ? undefined : parseSchemaFile({ path: paths.schema, text: schema })

      texts.set(paths.schema, parsed && 'schema' in parsed && same(parsed.schema, changeset.schema) ? schema : serializeSchema(changeset.schema, config))

      const files = await Promise.all([...texts].map(async ([path, after]) => ({ path, after, changed: await readText(join(root, path)) !== after })))
      const changed = files.filter(item => item.changed)

      await place(changed)

      return changed.map(item => item.path)
    },
  }
}
