import type { ForgePressSchema } from '../core/schema'
import type { ContentRow } from './reader'

export interface ContentWriter {
  writeSchema: (schema: ForgePressSchema) => Promise<void>
  writeEntry: (collection: string, row: ContentRow) => Promise<void>
  removeEntry: (collection: string, id: string) => Promise<void>
  writeContent: (collection: string, rows: ContentRow[]) => Promise<void>
  removeCollection: (collection: string) => Promise<void>
}
