import type { InjectionKey } from 'vue'
import type { Draft, DraftService } from '../../types/content/draft'
import type { MediaClient } from '../../types/content/media'
import type { ContentStore } from '../../types/content/store'

import { createDraft } from '../../content/draft'
import { bakedMedia, isLocal, source } from '../../content/source'
import { lazyMedia, lazyStore, persist } from '../../content/store'
import { media } from '../media'
import { writer } from '../writer'

export type EditorMode = 'development' | 'static'

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
  draft: () => Promise<DraftService | undefined>
}

interface Resolved {
  store: ContentStore
  media: MediaClient
  draft?: DraftService
}

export const contentKey: InjectionKey<EditorContent> = Symbol('webenv:editor:content')

let resolved: Promise<Resolved> | undefined

async function build(): Promise<Resolved> {
  if (await isLocal())
    return { store: { schema: source.schema, list: source.list, ...writer }, media }

  const draft = createDraft(source, bakedMedia, persist<Draft>('draft'))

  return { store: draft.content, media: draft.media, draft }
}

function resolve(): Promise<Resolved> {
  resolved ??= build()

  return resolved
}

async function mode(): Promise<EditorMode> {
  return await isLocal() ? 'development' : 'static'
}

export function createContent(): EditorContent {
  return {
    mode,
    store: lazyStore(async () => (await resolve()).store),
    media: lazyMedia(async () => (await resolve()).media),
    draft: async () => (await resolve()).draft,
  }
}
