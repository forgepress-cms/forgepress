declare module 'virtual:forgepress/settings' {
  export const local: boolean
  export const devServer: string
  export const media: import('../media/types').MediaSettings
  export const provider: import('../types/config').ProviderConfig | null
  export const format: import('../types/config').ContentConfig | null
  export const contentPath: string
}
