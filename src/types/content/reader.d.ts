import type { ElementContentMetadata } from '../core/element'

export type ContentRow = ElementContentMetadata & {
  [field: string]: unknown
}

export interface ContentReader {
  list: (component: string) => Promise<ContentRow[]>
  get: (component: string, id: string) => Promise<ContentRow | undefined>
}
