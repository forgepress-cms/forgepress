import type { ElementContentMetadata } from '../core/element'
import type { WebenvSchema } from '../core/schema'

export type ContentRow = ElementContentMetadata & {
  [field: string]: unknown
}

export interface ContentSource {
  schema: () => Promise<WebenvSchema>
  list: (component: string) => Promise<ContentRow[]>
}

export interface ContentReader extends ContentSource {
  get: (component: string, id: string) => Promise<ContentRow | undefined>
}
