import type { Conflict, FileChange, RepoTarget } from '../forge/types'
import type { MediaAsset, MediaClient, PendingUpload } from '../media/types'
import type { ContentStore } from '../store/types'
import type { Entry, EntryRef } from '../types/entry'

export interface Changes {
  entries: Record<string, Record<string, Entry | null>>
  uploads: Record<string, PendingUpload>
  removed: string[]
  publishedMedia?: Record<string, PendingUpload>
  hashes?: ChangeHashes
}

export interface ChangeHashes {
  entries: Record<string, Record<string, string | null>>
}

export type Resolution = 'mine' | 'theirs'

export interface ChangeSummary {
  written: EntryRef[]
  discarded: EntryRef[]
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
  summary: () => Promise<ChangeSummary>
  files: (target: RepoTarget) => Promise<FileChange[]>
  diff: (target: RepoTarget) => Promise<FileDiff[]>
  resolve: (conflicts: readonly Conflict[], target: RepoTarget, keep: Resolution) => Promise<void>
  published: () => Promise<void>
  discard: () => Promise<void>
  subscribe: (listener: () => void) => () => void
}
