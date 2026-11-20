import type { Changes, ChangeService } from '../../../src/changes'
import type { ForgeSource, RepoTarget } from '../../../src/forge'
import type { MediaClient } from '../../../src/media'
import type { ContentStore, SchemaStore } from '../../../src/store'
import type { BakedSettings } from '../../settings'
import { createChanges } from '../../../src/changes'
import { createEndpoint } from '../../../src/endpoint'
import { prefixer, repositoryPaths } from '../../../src/files'
import { createForgeSource } from '../../../src/forge'
import { isServed } from '../../../src/media'
import { announcing } from '../../../src/preview'
import { CHANGES_KEY, lazyMedia, lazyStore, persist, repositoryCache } from '../../../src/store'
import { once } from '../../../src/utils'
import { baked } from '../../settings'
import { useSession } from '../session/useSession'

type EditorMode = 'development' | 'static'

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
  schemaStore: () => Promise<SchemaStore | undefined>
  changes: () => Promise<ChangeService | undefined>
  target: () => Promise<RepoTarget>
  read: (sha: string) => Promise<string>
  pin: (commit: string) => Promise<void>
  published: (commit: string) => Promise<void>
}

interface Resolved {
  store: ContentStore
  media: MediaClient
  schemaStore?: SchemaStore
  changes?: ChangeService
  source?: ForgeSource
}

function repositoryTarget(settings: BakedSettings): RepoTarget {
  const base = settings.provider?.base

  return { paths: repositoryPaths(settings.paths, base), mediaDir: prefixer(base)(settings.media.dir), format: settings.format }
}

async function build(): Promise<Resolved> {
  const settings = await baked()

  if (settings.local) {
    const { reader, writer, schema, media } = createEndpoint(settings.devServer)

    return { store: { ...reader, ...writer }, media, schemaStore: schema }
  }

  const session = useSession()
  const source = createForgeSource(() => session.forge(), repositoryTarget(settings), repositoryCache())
  const uploads = { settings: async () => settings.media, stored: () => source.media(), served: isServed }
  const changes = createChanges(source, uploads, announcing(persist<Changes>(CHANGES_KEY)), source.hashes)

  return { store: changes.content, media: changes.media, changes, source }
}

const resolve = once(build)

const content: EditorContent = {
  mode: async () => (await baked()).local ? 'development' : 'static',
  store: lazyStore(async () => (await resolve()).store),
  media: lazyMedia(async () => (await resolve()).media),
  schemaStore: async () => (await resolve()).schemaStore,
  changes: async () => (await resolve()).changes,

  target: async () => repositoryTarget(await baked()),

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
