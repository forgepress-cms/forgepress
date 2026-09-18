import type { EntryFile, ParsedContent } from '../entries/check'
import type { Entry } from '../entries/types'
import type { ContentSource } from '../store/types'
import type { ContentPaths } from './paths'
import { parseContent } from '../entries/check'
import { sortByCreation } from '../entries/order'
import { isRecord } from '../utils/value'
import { parseEntry, parseFile, parseSchema } from './parse'
import { isEntryFile, isEntryId, toEntryId, toEntryRef } from './paths'

export interface ContentFiles {
  list: (directory: string) => Promise<string[]>
  read: (path: string) => Promise<string | undefined>
}

async function entryFile(files: ContentFiles, content: string, path: string): Promise<EntryFile[]> {
  const entry = toEntryRef(content, path)
  const text = entry && await files.read(path)

  return entry && text !== undefined ? [{ ...entry, path, text }] : []
}

export async function readEntries(files: ContentFiles, paths: ContentPaths): Promise<Record<string, Entry[]>> {
  const listed = await files.list(paths.content)
  const entries = await Promise.all(listed.sort().map(path => entryFile(files, paths.content, path)))
  const found: Record<string, Entry[]> = {}

  for (const file of entries.flat()) {
    const parsed = parseFile(file)

    if ('value' in parsed && isRecord(parsed.value) && parsed.value.id === file.id)
      (found[file.collection] ??= []).push(parsed.value as Entry)
  }

  return Object.fromEntries(Object.entries(found).map(([collection, rows]) => [collection, sortByCreation(rows)]))
}

export async function readContent(files: ContentFiles, paths: ContentPaths): Promise<ParsedContent> {
  const [schema, listed] = await Promise.all([files.read(paths.schema), files.list(paths.content)])
  const entries = await Promise.all(listed.sort().map(path => entryFile(files, paths.content, path)))

  return parseContent(schema === undefined ? undefined : { path: paths.schema, text: schema }, entries.flat())
}

export function createFileSource(files: ContentFiles, paths: ContentPaths): ContentSource {
  async function entry(collection: string, id: string): Promise<Entry | undefined> {
    if (!isEntryId(id))
      return undefined

    const path = paths.entry(collection, id)
    const text = await files.read(path)

    return text === undefined ? undefined : parseEntry(text, path)
  }

  return {
    schema: async () => {
      const text = await files.read(paths.schema)

      return text === undefined ? { collections: {} } : parseSchema(text, paths.schema)
    },

    list: async (collection) => {
      const directory = paths.collection(collection)
      const ids = (await files.list(directory)).map(path => path.slice(directory.length + 1)).filter(isEntryFile).map(toEntryId)
      const rows = await Promise.all(ids.map(id => entry(collection, id)))

      return sortByCreation(rows.filter(row => row !== undefined))
    },

    entry,
  }
}
