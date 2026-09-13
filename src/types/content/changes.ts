import type { ForgePressSchema } from '../core/schema'
import type { MediaAsset, MediaClient, PendingUpload } from './media'
import type { ContentRow } from './reader'
import type { ContentStore } from './store'
import type { RepoTarget } from './target'

export interface EntryRef {
  collection: string
  id: string
}

export interface Changes {
  published?: string
  schema?: ForgePressSchema
  entries: Record<string, Record<string, ContentRow | null>>
  dropped: string[]
  uploads: Record<string, PendingUpload>
  removed: string[]
}

export interface ChangeSummary {
  published?: string
  schema: boolean
  written: EntryRef[]
  discarded: EntryRef[]
  dropped: string[]
  uploaded: string[]
  deleted: string[]
}

export type DiffKind = 'keep' | 'add' | 'remove'

export interface DiffLine {
  kind: DiffKind
  text: string
}

export interface FileDiff {
  path: string
  change: 'added' | 'changed' | 'removed'
  lines?: DiffLine[]
  before?: MediaAsset
  after?: MediaAsset
}

export interface ChangeService {
  content: ContentStore
  media: MediaClient
  snapshot: () => Promise<Changes>
  summary: () => Promise<ChangeSummary>
  diff: (target: RepoTarget) => Promise<FileDiff[]>
  published: (commit: string) => Promise<void>
  discard: () => Promise<void>
}
