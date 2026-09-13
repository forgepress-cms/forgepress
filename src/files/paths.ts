export const DEFAULT_CONTENT_PATH = '.forgepress'
export const ENDPOINT = '/__forgepress'

const ENTRY_FILE = /\.ts$/
const ENTRY_ID = /^[\w-]+$/
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

export function isEntryFile(file: string): boolean {
  return ENTRY_FILE.test(file) && isEntryId(toEntryId(file))
}

export function prefixer(base?: string): (path: string) => string {
  const prefix = base?.replace(EDGE_SLASHES, '') ?? ''

  return path => prefix ? `${prefix}/${path}` : path
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
