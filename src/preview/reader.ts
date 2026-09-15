import type { Changes } from '../changes/types'
import type { ContentEntries } from '../entries/references'
import type { OAuthTokens } from '../forge/types'
import type { PendingUpload } from '../media/types'
import type { Entry } from '../types/entry'
import type { PreviewSettings } from './state'
import { createContentChanges } from '../changes/content'
import { publishedUploads } from '../changes/media'
import { createPreviews } from '../changes/previews'
import { createPaths } from '../files/paths'
import { createForge } from '../forge'
import { refreshed, storedTokens } from '../forge/oauth'
import { createForgeSource } from '../forge/source'
import { createOutput } from '../output'
import { CHANGES_KEY, persist, repositoryCache, TOKEN_KEY } from '../storage'
import { isRecord } from '../utils/value'

export type PreviewFiles = ReadonlyMap<string, string>

export interface PreviewReader {
  build: () => Promise<PreviewFiles>
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

function uploads(changes: Changes): PendingUpload[] {
  return [...Object.values(changes.uploads), ...publishedUploads(changes)]
}

export function createPreviewReader(settings: PreviewSettings): PreviewReader {
  const tokens = persist<OAuthTokens | string>(TOKEN_KEY)
  const pending = persist<Changes>(CHANGES_KEY)
  const previews = createPreviews()
  const shown = new Set<string>()

  let token: Promise<string> | undefined

  async function access(): Promise<string> {
    const saved = storedTokens(await tokens.read())

    if (!saved)
      throw new Error('[forgepress] sign in to the editor to preview unpublished content')

    const current = await refreshed(saved, settings.provider)

    if (current !== saved)
      await tokens.write(current)

    return current.access
  }

  const forge = createForge(settings.provider, () => {
    token ??= access()

    return token
  })

  const source = createForgeSource(() => forge, createPaths(settings.contentPath), settings.provider.base, repositoryCache())

  function local(changes: Changes): ReadonlyMap<string, string> {
    const assets = uploads(changes).map(upload => previews.asset(upload, settings.mediaUrl))
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
    build: async () => {
      token = undefined
      source.reset()

      const changes: Changes = { entries: {}, uploads: {}, removed: [], ...await pending.read() }
      const content = createContentChanges(source, async () => changes, async () => {
        throw new Error('[forgepress] the preview only reads content')
      })

      const schema = await content.schema()
      const urls = local(changes)
      const listed = await Promise.all(Object.keys(schema.collections).map(async collection => [collection, await content.list(collection)] as const))

      const entries: ContentEntries = Object.fromEntries(listed.map(([collection, rows]) => [
        collection,
        Object.fromEntries(rows.map(row => [row.id, urls.size > 0 ? swap(row, urls) as Entry : row])),
      ]))

      const files = await createOutput(schema, entries, { commit: null, unpublished: true })

      return new Map(files.map(file => [file.path, file.text]))
    },
  }
}
