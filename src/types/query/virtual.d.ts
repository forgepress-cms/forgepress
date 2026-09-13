declare module 'virtual:forgepress/content' {
  type Row = import('../content/reader').ContentRow

  interface CollectionLoaders {
    list: () => Promise<{ default: Row[] }>
    entry: Record<string, () => Promise<{ default: Row }>>
  }

  export const local: boolean
  export const media: import('../content/media').BakedMedia
  export const provider: import('../config/provider').ProviderConfig | null
  export const format: import('../config/content').ContentConfig | null
  export const contentPath: string
  export const schema: import('../core/schema').ForgePressSchema
  export const content: Record<string, CollectionLoaders>
}
