import type { EntryRef } from '../entries'
import { isEntryId } from '../entries'
import { isCollectionName } from '../schema'

export const DEFAULT_CONTENT_PATH = '.forgepress'

const ENTRY_FILE = /\.ts$/
const EDGE_SLASHES = /^\/+|\/+$/g

export interface ContentPaths {
  readonly dir: string
  readonly content: string
  readonly schema: string
  readonly types: string
  readonly collection: (collection: string) => string
  readonly entry: (collection: string, id: string) => string
}

export function normalizeDir(path: string | undefined): string {
  return (path ?? DEFAULT_CONTENT_PATH).replace(/\\/g, '/').replace(EDGE_SLASHES, '') || DEFAULT_CONTENT_PATH
}

export function toCollectionName(directory: string): string {
  return directory.replace(/-(\w)/g, (_, char: string) => char.toUpperCase())
}

export function toCollectionDir(collection: string): string {
  return collection.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`).replace(/^-/, '')
}

export function toEntryFile(id: string): string {
  return `${id}.ts`
}

export function toEntryId(file: string): string {
  return file.replace(ENTRY_FILE, '')
}

export function isEntryFile(file: string): boolean {
  return ENTRY_FILE.test(file) && isEntryId(toEntryId(file))
}

function singleCollection(file: string): string | undefined {
  const name = toEntryId(file)
  const collection = toCollectionName(name)

  return ENTRY_FILE.test(file) && isCollectionName(collection) && toCollectionDir(collection) === name ? collection : undefined
}

export function toEntryRef(content: string, path: string): EntryRef | undefined {
  const parts = path.startsWith(`${content}/`) ? path.slice(content.length + 1).split('/') : []
  const [directory, file] = parts

  if (parts.length === 1 && directory) {
    const collection = singleCollection(directory)

    return collection === undefined ? undefined : { collection, id: collection }
  }

  if (parts.length !== 2 || !directory || !file || !isEntryFile(file))
    return undefined

  const collection = toCollectionName(directory)
  const id = toEntryId(file)

  return id === collection ? undefined : { collection, id }
}

export function repositoryPath(path: string): string {
  const segments: string[] = []

  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.')
      continue

    if (segment !== '..')
      segments.push(segment)
    else if (segments.pop() === undefined)
      throw new Error(`[forgepress] ${JSON.stringify(path)} points outside the repository`)
  }

  return segments.join('/')
}

export function prefixer(base?: string): (path: string) => string {
  const prefix = base?.replace(/\\/g, '/').replace(EDGE_SLASHES, '') ?? ''

  return path => repositoryPath(prefix ? `${prefix}/${path}` : path)
}

export function repositoryPaths(paths: ContentPaths, base?: string): ContentPaths {
  const at = prefixer(base)

  return {
    dir: at(paths.dir),
    content: at(paths.content),
    schema: at(paths.schema),
    types: at(paths.types),
    collection: name => at(paths.collection(name)),
    entry: (name, id) => at(paths.entry(name, id)),
  }
}

export function createPaths(path?: string): ContentPaths {
  const dir = normalizeDir(path)
  const content = `${dir}/content`

  const collection = (name: string): string => `${content}/${toCollectionDir(name)}`

  return {
    dir,
    content,
    schema: `${dir}/schema.ts`,
    types: `${dir}/forgepress.d.ts`,
    collection,
    entry: (name, id) => id === name ? `${collection(name)}.ts` : `${collection(name)}/${toEntryFile(id)}`,
  }
}

export const defaultPaths: ContentPaths = createPaths()
