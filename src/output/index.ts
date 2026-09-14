import type { ContentEntries } from '../entries/references'
import type { OutputConfig } from '../types/config'
import type { Entry } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import type { OutputCollection, OutputEntry, OutputFile, OutputIndex, OutputManifest } from './types'
import { sortByCreation } from '../entries/order'
import { toCollectionDir } from '../files/paths'
import { digest } from '../utils/encoding'
import { defined } from '../utils/value'
import { indexedFields, isLocalized, linkFields, toOutputEntry } from './entry'
import { OUTPUT_INDEX, OUTPUT_VERSION } from './types'

export const OUTPUT_DEFAULTS = {
  dir: 'public/content',
} as const satisfies Required<OutputConfig>

export type ResolvedOutput = Required<OutputConfig>

export interface OutputOptions {
  commit: string | null
  dev?: boolean
}

interface CollectionOutput {
  files: OutputFile[]
  manifest: OutputFile
}

export function resolveOutput(config?: OutputConfig): ResolvedOutput {
  return { ...OUTPUT_DEFAULTS, ...defined(config) }
}

async function hashed(folder: string, name: string, value: unknown): Promise<OutputFile> {
  const text = JSON.stringify(value)
  const hash = await digest('SHA-256', new TextEncoder().encode(text))

  return { path: `${folder}/${name}.${hash.slice(0, 8)}.json`, text }
}

function listed(entry: OutputEntry, indexed: readonly string[]): OutputEntry {
  const item: OutputEntry = { id: entry.id, createdAt: entry.createdAt, updatedAt: entry.updatedAt }

  for (const field of indexed) {
    if (entry[field] !== undefined)
      item[field] = entry[field]
  }

  return item
}

async function collectionOutput(schema: ForgePressSchema, collection: string, entries: readonly Entry[], locale?: string): Promise<CollectionOutput> {
  const folder = locale === undefined ? toCollectionDir(collection) : `${toCollectionDir(collection)}/${locale}`
  const indexed = indexedFields(schema, collection)
  const converted = entries.map(entry => toOutputEntry(schema, collection, entry, locale))
  const files = await Promise.all(converted.map(entry => hashed(folder, entry.id, entry)))

  const manifest: OutputManifest = {
    indexed,
    links: linkFields(schema, collection),
    entries: converted.map(entry => listed(entry, indexed)),
    files: Object.fromEntries(converted.map((entry, index) => [entry.id, files[index]!.path])),
  }

  return { files, manifest: await hashed(folder, 'index', manifest) }
}

export async function createOutput(schema: ForgePressSchema, content: ContentEntries, options: OutputOptions): Promise<OutputFile[]> {
  const locales = [...schema.locales ?? []]
  const files: OutputFile[] = []
  const collections: Record<string, OutputCollection> = {}

  for (const collection of Object.keys(schema.collections)) {
    const stored = Object.entries(content[collection] ?? {}).map(([id, entry]) => entry.id === id ? entry : { ...entry, id })
    const entries = sortByCreation(stored.filter(entry => entry.status === 'published'))

    if (!isLocalized(schema, collection)) {
      const output = await collectionOutput(schema, collection, entries)

      files.push(...output.files, output.manifest)
      collections[collection] = { localized: false, manifest: output.manifest.path }
      continue
    }

    const manifests: Record<string, string> = {}

    for (const locale of locales) {
      const output = await collectionOutput(schema, collection, entries, locale)

      files.push(...output.files, output.manifest)
      manifests[locale] = output.manifest.path
    }

    collections[collection] = { localized: true, manifests }
  }

  const index: OutputIndex = {
    version: OUTPUT_VERSION,
    commit: options.commit,
    ...options.dev ? { dev: true } : {},
    locales,
    collections,
  }

  return [...files, { path: OUTPUT_INDEX, text: `${JSON.stringify(index, null, 2)}\n` }]
}
