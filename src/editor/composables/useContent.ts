import type { Changes, ChangeService } from '../../changes/types'
import type { ForgeSource } from '../../forge/source'
import type { RepoTarget } from '../../forge/types'
import type { MediaClient } from '../../media/types'
import type { ContentStore, SchemaWriter } from '../../store/types'
import { createChanges } from '../../changes'
import { createForgeSource } from '../../forge/source'
import { isServed } from '../../media'
import { announcing } from '../../preview/state'
import { CHANGES_KEY, persist, repositoryCache } from '../../storage'
import { lazyMedia, lazyStore } from '../../store/lazy'
import { createEndpoint } from '../endpoint'
import { baked } from '../settings'
import { useSession } from './useSession'

export type EditorMode = 'development' | 'static'

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
  schemaWriter: () => Promise<SchemaWriter | undefined>
  changes: () => Promise<ChangeService | undefined>
  target: () => Promise<RepoTarget>
  read: (sha: string) => Promise<string>
  pin: (commit: string) => Promise<void>
  published: (commit: string) => Promise<void>
}

interface Resolved {
  store: ContentStore
  media: MediaClient
  schemaWriter?: SchemaWriter
  changes?: ChangeService
  source?: ForgeSource
}

let resolved: Promise<Resolved> | undefined

async function build(): Promise<Resolved> {
  const settings = await baked()

  if (settings.local) {
    const { reader, writer, media } = createEndpoint(settings.devServer)

    return { store: { ...reader, ...writer }, media, schemaWriter: writer }
  }

  const session = useSession()
  const source = createForgeSource(() => session.forge(), settings.paths, settings.provider?.base, repositoryCache(), settings.media.dir)
  const uploads = { settings: async () => settings.media, stored: () => source.media(), served: isServed }
  const changes = createChanges(source, uploads, announcing(persist<Changes>(CHANGES_KEY)), source.hashes)

  return { store: changes.content, media: changes.media, changes, source }
}

function resolve(): Promise<Resolved> {
  resolved ??= build()

  return resolved
}

const content: EditorContent = {
  mode: async () => (await baked()).local ? 'development' : 'static',
  store: lazyStore(async () => (await resolve()).store),
  media: lazyMedia(async () => (await resolve()).media),
  schemaWriter: async () => (await resolve()).schemaWriter,
  changes: async () => (await resolve()).changes,

  target: async () => {
    const settings = await baked()

    return { paths: settings.paths, mediaDir: settings.media.dir, base: settings.provider?.base, format: settings.format }
  },

  read: async (sha) => {
    const { source } = await resolve()

    if (!source)
      throw new Error('[forgepress] the editor in development reads files from disk, not from the repository')

    return source.read(sha)
  },

  pin: async (commit) => {
    const { source } = await resolve()

    source?.reset(commit)
  },

  published: async (commit) => {
    const { source, changes } = await resolve()

    source?.reset(commit)
    await changes?.published()
  },
}

export function useContent(): EditorContent {
  return content
}
