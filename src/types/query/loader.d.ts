export interface ContentRow {
  id: string
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
  [field: string]: unknown
}

export interface ContentLoader {
  list: (component: string) => Promise<ContentRow[]>
  get: (component: string, id: string) => Promise<ContentRow | undefined>
}
