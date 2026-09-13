declare module 'virtual:forgepress/content' {
  type Row = import('../types/entry').ContentRow

  interface CollectionLoaders {
    list: () => Promise<{ default: Row[] }>
    entry: Record<string, () => Promise<{ default: Row }>>
  }

  export const local: boolean
  export const media: import('../media/types').BakedMedia
  export const provider: import('../types/config').ProviderConfig | null
  export const format: import('../types/config').ContentConfig | null
  export const contentPath: string
  export const schema: import('../types/schema').ForgePressSchema
  export const content: Record<string, CollectionLoaders>
}
