import type { ResolvedConfig } from '../config/resolve'
import type { CollectionDirectory } from '../disk/collections'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readCollections } from '../disk/collections'
import { createMediaStore } from '../disk/media'
import { ContentError } from '../files/issues'
import { parseEntry, parseSchema } from '../files/parse'
import { toEntryFile } from '../files/paths'

export const VIRTUAL_ID = 'virtual:forgepress/content'
export const LIST_PREFIX = 'virtual:forgepress/list/'
export const ENTRY_PREFIX = 'virtual:forgepress/entry/'

export function resolved(id: string): string {
  return `\0${id}`
}

function entryFile(config: ResolvedConfig, directory: string, id: string): string {
  return `${config.paths.content}/${directory}/${toEntryFile(id)}`
}

async function unpublished(root: string, file: string): Promise<boolean> {
  try {
    return parseEntry(await readFile(join(root, file), 'utf8'), file).status !== 'published'
  }
  catch (error) {
    if (error instanceof ContentError)
      return false

    throw error
  }
}

async function published(root: string, config: ResolvedConfig, collection: CollectionDirectory): Promise<CollectionDirectory> {
  const hidden = await Promise.all(collection.ids.map(id => unpublished(root, entryFile(config, collection.directory, id))))

  return { ...collection, ids: collection.ids.filter((_, index) => !hidden[index]) }
}

function entryModule(collection: CollectionDirectory, id: string): string {
  return JSON.stringify(`${ENTRY_PREFIX}${collection.directory}/${id}`)
}

function loaders(collection: CollectionDirectory): string {
  const entries = collection.ids.map(id => `      ${JSON.stringify(id)}: () => import(${entryModule(collection, id)}),`)

  return [
    `  ${JSON.stringify(collection.collection)}: {`,
    `    list: () => import(${JSON.stringify(LIST_PREFIX + collection.directory)}),`,
    '    entry: {',
    ...entries,
    '    },',
    '  },',
  ].join('\n')
}

export async function generateRoot(root: string, local: boolean, config: ResolvedConfig): Promise<string> {
  const assets = await createMediaStore(root, config.media).list()
  const collections = await Promise.all(readCollections(root, config.paths).map(collection => published(root, config, collection)))
  const schema = parseSchema(await readFile(join(root, config.paths.schema), 'utf8'), config.paths.schema)

  return [
    `export const local = ${local}`,
    `export const provider = ${JSON.stringify(config.provider ?? null)}`,
    `export const format = ${JSON.stringify(config.content ?? null)}`,
    `export const contentPath = ${JSON.stringify(config.paths.dir)}`,
    `export const media = ${JSON.stringify({ ...config.media, assets })}`,
    `export const schema = ${JSON.stringify(schema)}`,
    `export const content = {\n${collections.map(loaders).join('\n')}\n}`,
    '',
  ].join('\n')
}

export function generateList(collection: CollectionDirectory): string {
  const imports = collection.ids.map((id, index) => `import entry${index} from ${entryModule(collection, id)}`)
  const items = collection.ids.map((_, index) => `entry${index}`)

  return [...imports, '', `export default [${items.join(', ')}]`, ''].join('\n')
}

export async function findCollection(root: string, config: ResolvedConfig, directory: string): Promise<CollectionDirectory | undefined> {
  const collection = readCollections(root, config.paths).find(item => item.directory === directory)

  return collection && published(root, config, collection)
}

export async function generateEntry(root: string, config: ResolvedConfig, path: string): Promise<string> {
  const [directory = '', id = ''] = path.split('/')

  if (!(await findCollection(root, config, directory))?.ids.includes(id))
    throw new Error(`[forgepress] there is no published entry "${path}"`)

  const file = entryFile(config, directory, id)

  return `export default ${JSON.stringify(parseEntry(await readFile(join(root, file), 'utf8'), file))}\n`
}
