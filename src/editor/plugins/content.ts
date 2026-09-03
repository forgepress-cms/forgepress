import type { InjectionKey } from 'vue'
import type { MediaBuffer } from '../../content/media/browser'
import type { MediaClient, StoredMedia } from '../../types/content/media'
import type { ChangeSet, ContentStore, StoredChanges } from '../../types/content/store'

import { createChangeSet } from '../../content/changes'
import { createMediaBuffer } from '../../content/media/browser'
import { bakedMedia, isLocal, source } from '../../content/source'
import { lazyMedia, lazyStore, persist } from '../../content/store'
import { media } from '../media'
import { writer } from '../writer'

export type EditorMode = 'development' | 'static'

export interface EditorDraft {
  changes: ChangeSet
  uploads: MediaBuffer
}

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
  draft: () => Promise<EditorDraft | undefined>
}

interface Resolved {
  store: ContentStore
  media: MediaClient
  draft?: EditorDraft
}

export const contentKey: InjectionKey<EditorContent> = Symbol('webenv:editor:content')

let resolved: Promise<Resolved> | undefined

async function build(): Promise<Resolved> {
  if (await isLocal())
    return { store: { schema: source.schema, list: source.list, ...writer }, media }

  const changes = createChangeSet(source, persist<StoredChanges>('content'))
  const uploads = createMediaBuffer(bakedMedia, persist<StoredMedia>('media'))

  return { store: changes, media: uploads, draft: { changes, uploads } }
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
