import type { InjectionKey } from 'vue'
import type { Changes, ChangeService } from '../../types/content/changes'
import type { MediaClient } from '../../types/content/media'
import type { ContentStore } from '../../types/content/store'

import { createChanges } from '../../content/changes'
import { baked, source } from '../../content/source'
import { lazyMedia, lazyStore, persist } from '../../content/store'
import { media } from '../media'
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
