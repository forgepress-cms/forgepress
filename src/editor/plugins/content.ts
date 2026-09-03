import type { InjectionKey } from 'vue'
import type { MediaClient, StoredMedia } from '../../types/content/media'
import type { ContentStore, KeyValueStore, StoredChanges } from '../../types/content/store'

import { createChangeSet, createMemoryStore } from '../../content/changes'
import { createIdbStore } from '../../content/changes/idb'
import { createMediaBuffer } from '../../content/media/browser'
import { bakedMedia, isLocal, source } from '../../content/source'
import { lazyMedia, lazyStore } from '../../content/store'
import { media } from '../media'
import { writer } from '../writer'

export type EditorMode = 'development' | 'static'

export interface EditorContent {
  mode: () => Promise<EditorMode>
  store: ContentStore
  media: MediaClient
}

export const contentKey: InjectionKey<EditorContent> = Symbol('webenv:editor:content')

function persist<TValue>(key: string): KeyValueStore<TValue> {
  return typeof indexedDB === 'undefined' ? createMemoryStore<TValue>() : createIdbStore<TValue>(key)
}

async function mode(): Promise<EditorMode> {
  return await isLocal() ? 'development' : 'static'
}

async function selectStore(): Promise<ContentStore> {
  if (await isLocal())
    return { schema: source.schema, list: source.list, ...writer }

  return createChangeSet(source, persist<StoredChanges>('content'))
}

async function selectMedia(): Promise<MediaClient> {
  if (await isLocal())
    return media

  return createMediaBuffer(bakedMedia, persist<StoredMedia>('media'))
}

export function createContent(): EditorContent {
  return { mode, store: lazyStore(selectStore), media: lazyMedia(selectMedia) }
}
