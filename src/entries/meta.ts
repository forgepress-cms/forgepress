import type { EntryMeta, EntryStatus, OutputMeta } from './types'

export const META_KEYS: readonly (keyof EntryMeta)[] = ['id', 'status', 'createdAt', 'updatedAt']

export const OUTPUT_META_KEYS: readonly (keyof OutputMeta)[] = ['id', 'createdAt', 'updatedAt']

export const ENTRY_STATUSES: readonly EntryStatus[] = ['published', 'unpublished']
