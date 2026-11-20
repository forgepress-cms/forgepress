export type EntryStatus = 'published' | 'unpublished'

export interface EntryMeta {
  id: string
  status: EntryStatus
  createdAt: string
  updatedAt: string
}

export interface OutputMeta {
  id: string
  createdAt: string
  updatedAt: string
}

export const META_KEYS: readonly (keyof EntryMeta)[] = ['id', 'status', 'createdAt', 'updatedAt']

export const OUTPUT_META_KEYS: readonly (keyof OutputMeta)[] = ['id', 'createdAt', 'updatedAt']

export const ENTRY_STATUSES: readonly EntryStatus[] = ['published', 'unpublished']
