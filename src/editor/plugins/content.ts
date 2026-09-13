import type { InjectionKey } from 'vue'
import type { Changes, ChangeService } from '../../changes/types'
import type { MediaClient } from '../../media/types'
import type { ContentStore } from '../../store/types'

import { createChanges } from '../../changes'
import { baked, source } from '../../store/bundle'
import { lazyMedia, lazyStore } from '../../store/lazy'
import { media } from '../media'
import { persist } from '../storage'
import { writer } from '../writer'

export type EditorMode = 'development' | 'static'

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
  changes: () => Promise<ChangeService | undefined>
}

interface Resolved {
  store: ContentStore
  media: MediaClient
  changes?: ChangeService
}

export const contentKey: InjectionKey<EditorContent> = Symbol('forgepress:editor:content')

let resolved: Promise<Resolved> | undefined

async function build(): Promise<Resolved> {
  if ((await baked()).local)
    return { store: { ...source, ...writer }, media }

  const changes = createChanges(source, async () => (await baked()).media, persist<Changes>('changes'))

  return { store: changes.content, media: changes.media, changes }
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
  }
}
