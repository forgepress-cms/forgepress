import type { ContentRow, EntryMeta } from '../types/entry'

export const META_KEYS: readonly (keyof EntryMeta)[] = ['id', 'status', 'createdAt', 'updatedAt']

export function toMeta(row: ContentRow): EntryMeta {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
