import type { Changes } from '../changes'
import type { CollectionEntry, ContentEntries, Entry } from '../entries'
import type { OAuthTokens } from '../forge'
import type { ContentStore } from '../store'
import type { PreviewSettings, PreviewSource } from './state'
import { createContentChanges, createPreviews, emptyChanges, localUploads, readChanges } from '../changes'
import { createEndpoint } from '../endpoint'
import { createPaths, repositoryPaths } from '../files'
import { createForge, createForgeSource, createTokenGetter, storedTokens } from '../forge'
import { createOutput } from '../output'
import { CHANGES_KEY, persist, repositoryCache, TOKEN_KEY } from '../store'
import { isRecord } from '../utils'

export type PreviewFiles = ReadonlyMap<string, string>

export interface PreviewReader {
  build: (draft?: readonly CollectionEntry[], fresh?: boolean) => Promise<PreviewFiles>
}

function swap(value: unknown, urls: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string')
    return [...urls].reduce((text, [url, local]) => text.split(url).join(local), value)

  if (Array.isArray(value))
    return value.map(item => swap(item, urls))

  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, swap(item, urls)]))

  return value
}

function withDraft(changes: Changes, draft: readonly CollectionEntry[]): Changes {
  if (draft.length === 0)
    return changes

  const entries = { ...changes.entries }

  for (const { collection, entry } of draft)
    entries[collection] = { ...entries[collection], [entry.id]: entry }

  return { ...changes, entries }
}

async function refuse(): Promise<void> {
  throw new Error('[forgepress] the preview only reads content')
}

async function render(content: ContentStore, urls: ReadonlyMap<string, string>): Promise<PreviewFiles> {
  const schema = await content.schema()
  const listed = await Promise.all(Object.keys(schema.collections).map(async collection => [collection, await content.list(collection)] as const))

  const entries: ContentEntries = Object.fromEntries(listed.map(([collection, rows]) => [
    collection,
    Object.fromEntries(rows.map(row => [row.id, urls.size > 0 ? swap(row, urls) as Entry : row])),
  ]))

  const files = await createOutput(schema, entries, { commit: null, unpublished: true })

  return new Map(files.map(file => [file.path, file.text]))
}

function createLocalReader(server: string): PreviewReader {
  const { reader } = createEndpoint(server)

  return {
    build: async (draft = []) => {
      const changes = withDraft(emptyChanges(), draft)

      return render(createContentChanges(reader, async () => changes, refuse), new Map())
    },
  }
}

function createForgeReader(settings: PreviewSettings): PreviewReader {
  const tokens = persist<OAuthTokens | string>(TOKEN_KEY)
  const pending = persist<Changes>(CHANGES_KEY)
  const previews = createPreviews()
  const shown = new Set<string>()

  let token: Promise<string> | undefined

  async function saved(): Promise<OAuthTokens> {
    const found = storedTokens(await tokens.read())

    if (!found)
      throw new Error('[forgepress] sign in to the editor to preview unpublished content')

    return found
  }

  const access = createTokenGetter(settings.provider, saved, next => tokens.write(next))

  const forge = createForge(settings.provider, () => {
    token ??= access()

    return token
  })

  const source = createForgeSource(() => forge, { paths: repositoryPaths(createPaths(settings.contentPath), settings.provider.base) }, repositoryCache())

  function local(changes: Changes): ReadonlyMap<string, string> {
    const assets = localUploads(changes).map(upload => previews.asset(upload, settings.mediaUrl))
    const names = new Set(assets.map(asset => asset.name))

    for (const name of shown) {
      if (!names.has(name))
        previews.forget(name)
    }

    shown.clear()

    for (const name of names)
      shown.add(name)

    return new Map(assets.flatMap(asset => asset.preview ? [[asset.url, asset.preview]] : []))
  }

  return {
    build: async (draft = [], fresh = true) => {
      if (fresh) {
        token = undefined
        source.reset()
      }

      const changes = withDraft(await readChanges(pending), draft)

      return render(createContentChanges(source, async () => changes, refuse), local(changes))
    },
  }
}

export function createPreviewReader(source: PreviewSource): PreviewReader {
  return 'server' in source ? createLocalReader(source.server) : createForgeReader(source)
}
