import type { ContentRow, ContentSource } from '../../types/content/reader'
import type { WebenvSchema } from '../../types/core/schema'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CONTENT_DIR, SCHEMA_FILE, toFileName } from '../paths'
import { findRoot } from '../root'
import { source as bundle, createReader } from '../source'

async function importDefault<TDefault>(file: string): Promise<TDefault> {
  const module = await import(/* @vite-ignore */ pathToFileURL(file).href) as { default: TDefault }
  return module.default
}

/** Reads a project's `.webenv` directory straight from disk, one component file at a time. */
export function createSource(start?: string): ContentSource {
  const rows = new Map<string, Promise<ContentRow[]>>()
  let root: string | undefined
  let schema: Promise<WebenvSchema> | undefined

  const resolve = (): string => (root ??= findRoot(start))

  return {
    schema: () => (schema ??= importDefault<WebenvSchema>(join(resolve(), SCHEMA_FILE))),
    list: (component) => {
      let pending = rows.get(component)

      if (!pending) {
        const file = join(resolve(), CONTENT_DIR, toFileName(component))
        pending = existsSync(file) ? importDefault<ContentRow[]>(file) : Promise.resolve([])
        rows.set(component, pending)
      }

      return pending
    },
  }
}

const disk = createSource()
let active: Promise<ContentSource> | undefined

/**
 * Prefers the content the webenv plugin compiled into the build and falls back
 * to the local `.webenv` directory when no bundler provided it.
 */
function select(): Promise<ContentSource> {
  active ??= bundle.schema().then(() => bundle, () => disk)
  return active
}

export const source: ContentSource = {
  schema: async () => (await select()).schema(),
  list: async component => (await select()).list(component),
}

export const reader = createReader(source)
