import type { InjectionKey } from 'vue'
import type { Changes, ChangeService } from '../../changes/types'
import type { ForgeSource } from '../../forge/source'
import type { MediaClient } from '../../media/types'
import type { ContentStore } from '../../store/types'

import { createChanges } from '../../changes'
import { createForgeSource } from '../../forge/source'
import { baked } from '../../store/bundle'
import { lazyMedia, lazyStore } from '../../store/lazy'
import { useSession } from '../composables/useSession'
import { reader, writer } from '../endpoint'
import { media } from '../media'
import { persist } from '../storage'

export type EditorMode = 'development' | 'static'

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
  changes: () => Promise<ChangeService | undefined>
  published: (commit: string) => Promise<void>
}

interface Resolved {
  store: ContentStore
  media: MediaClient
  changes?: ChangeService
  source?: ForgeSource
}

export const contentKey: InjectionKey<EditorContent> = Symbol('forgepress:editor:content')

let resolved: Promise<Resolved> | undefined

async function build(): Promise<Resolved> {
  const settings = await baked()

  if (settings.local)
    return { store: { ...reader, ...writer }, media }

  const session = useSession()
  const source = createForgeSource(() => session.forge(), settings.paths, settings.provider?.base)
  const changes = createChanges(source, async () => (await baked()).media, persist<Changes>('changes'))

  return { store: changes.content, media: changes.media, changes, source }
}

function resolve(): Promise<Resolved> {
  resolved ??= build()

  return resolved
}

async function mode(): Promise<EditorMode> {
  return (await baked()).local ? 'development' : 'static'
}

export function createContent(): EditorContent {
  return {
    mode,
    store: lazyStore(async () => (await resolve()).store),
    media: lazyMedia(async () => (await resolve()).media),
    changes: async () => (await resolve()).changes,

    published: async (commit) => {
      const { source, changes } = await resolve()

      source?.reset(commit)
      await changes?.published()
    },
  }
}
