import type { WebenvSchema } from '../core/schema'
import type { ContentRow } from './reader'

export interface ContentWriter {
  writeSchema: (schema: WebenvSchema) => Promise<void>
  writeContent: (component: string, rows: ContentRow[]) => Promise<void>
  removeContent: (component: string) => Promise<void>
}
