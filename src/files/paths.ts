import type { EntryRef } from '../types/entry'

export const DEFAULT_CONTENT_PATH = '.forgepress'
export const ENDPOINT = '/__forgepress'
export const EVENTS = `${ENDPOINT}/events`

const ENTRY_FILE = /\.ts$/
const ENTRY_ID = /^[\w-]+$/
const COLLECTION_NAME = /^[a-z][a-zA-Z\d]*$/
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

export function isEntryId(id: string): boolean {
  return ENTRY_ID.test(id)
}

export function isCollectionName(name: string): boolean {
  return COLLECTION_NAME.test(name)
}

export function isEntryFile(file: string): boolean {
  return ENTRY_FILE.test(file) && isEntryId(toEntryId(file))
}

export function toEntryRef(content: string, path: string): EntryRef | undefined {
  const [directory, file, ...deeper] = path.startsWith(`${content}/`) ? path.slice(content.length + 1).split('/') : []

  return directory && file && deeper.length === 0 && isEntryFile(file)
    ? { collection: toCollectionName(directory), id: toEntryId(file) }
    : undefined
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
    entry: (name, id) => `${collection(name)}/${toEntryFile(id)}`,
  }
}

export const defaultPaths: ContentPaths = createPaths()
