import type { WebenvSchema } from '../core/schema'
import type { MediaAsset, MediaClient, PendingUpload } from './media'
import type { ContentRow } from './reader'
import type { ContentStore } from './store'

export interface Draft {
  published?: string
  schema?: WebenvSchema
  components: Record<string, ContentRow[] | null>
  uploads: Record<string, PendingUpload>
  removed: string[]
}

export interface DraftSummary {
  published?: string
  schema: boolean
  written: string[]
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

export interface DraftTarget {
  mediaDir: string
  base?: string | undefined
  format?: import('../config/content').ContentConfig | undefined
}

export interface DraftService {
  content: ContentStore
  media: MediaClient
  snapshot: () => Promise<Draft>
  summary: () => Promise<DraftSummary>
  diff: (target: DraftTarget) => Promise<FileDiff[]>
  published: (commit: string) => Promise<void>
  discard: () => Promise<void>
}
