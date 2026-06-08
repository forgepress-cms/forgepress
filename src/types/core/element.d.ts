export interface Element {
  label?: string
  description?: string
  optional?: boolean
  translate?: boolean
}

export interface ElementContentMetadata {
  id: string
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
}
