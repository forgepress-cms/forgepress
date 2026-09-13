import type { Conflict, RepoTarget } from '../forge/types'
import type { MediaAsset, MediaClient, PendingUpload } from '../media/types'
import type { ContentStore } from '../store/types'
import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'

export interface EntryRef {
  collection: string
  id: string
}

export interface Changes {
  schema?: ForgePressSchema
  entries: Record<string, Record<string, ContentRow | null>>
  dropped: string[]
  uploads: Record<string, PendingUpload>
  removed: string[]
  publishedMedia?: Record<string, PendingUpload | null>
  hashes?: ChangeHashes
}

export interface ChangeHashes {
  schema?: string | null
  entries: Record<string, Record<string, string | null>>
}

export interface HashSource {
  schema: () => Promise<string | undefined>
  entry: (collection: string, id: string) => Promise<string | undefined>
}

export type Resolution = 'mine' | 'theirs'

export interface ChangeSummary {
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
  resolve: (conflicts: readonly Conflict[], target: RepoTarget, keep: Resolution) => Promise<void>
  published: () => Promise<void>
  discard: () => Promise<void>
}
