import type { ParsedContent } from '../entries/check'
import type { ContentPaths } from '../files/paths'
import type { ContentIssue } from '../types/issues'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseContent } from '../entries/check'
import { defaultPaths, toEntryFile } from '../files/paths'
import { readCollections } from './collections'

export async function loadContent(root: string, paths: ContentPaths = defaultPaths): Promise<ParsedContent> {
  const read = (path: string): Promise<string> => readFile(join(root, path), 'utf8')

  const entries = await Promise.all(readCollections(root, paths).flatMap(directory => directory.ids.map(async (id) => {
    const path = `${paths.content}/${directory.directory}/${toEntryFile(id)}`

    return { collection: directory.collection, id, path, text: await read(path) }
  })))

  const schema = existsSync(join(root, paths.schema)) ? { path: paths.schema, text: await read(paths.schema) } : undefined

  return parseContent(schema, entries)
}

export async function checkContent(root: string, paths: ContentPaths = defaultPaths): Promise<ContentIssue[]> {
  return (await loadContent(root, paths)).issues
}
