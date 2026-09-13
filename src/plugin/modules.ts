import type { ResolvedConfig } from '../config/resolve'
import type { CollectionDirectory } from '../disk/collections'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readCollections } from '../disk/collections'
import { createMediaStore } from '../disk/media'
import { parseEntry, parseSchema } from '../files/parse'
import { toEntryFile } from '../files/paths'

export const VIRTUAL_ID = 'virtual:forgepress/content'
export const LIST_PREFIX = 'virtual:forgepress/list/'
export const ENTRY_PREFIX = 'virtual:forgepress/entry/'

export function resolved(id: string): string {
  return `\0${id}`
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
  const collections = readCollections(root, config.paths)
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

export function findCollection(root: string, config: ResolvedConfig, directory: string): CollectionDirectory | undefined {
  return readCollections(root, config.paths).find(collection => collection.directory === directory)
}

export async function generateEntry(root: string, config: ResolvedConfig, path: string): Promise<string> {
  const [directory = '', id = ''] = path.split('/')

  if (!findCollection(root, config, directory)?.ids.includes(id))
    throw new Error(`[forgepress] there is no entry "${path}"`)

  const file = `${config.paths.content}/${directory}/${toEntryFile(id)}`

  return `export default ${JSON.stringify(parseEntry(await readFile(join(root, file), 'utf8'), file))}\n`
}
