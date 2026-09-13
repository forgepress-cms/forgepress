export type EntryStatus = 'published' | 'unpublished'

export interface EntryMeta {
  id: string
  status: EntryStatus
  createdAt: string
  updatedAt: string
}
