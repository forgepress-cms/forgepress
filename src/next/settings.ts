import type { MediaSettings } from '../media/types'
import type { ContentConfig, ProviderConfig } from '../types/config'

declare const __FORGEPRESS_SETTINGS__: string

interface Settings {
  local: boolean
  devServer: string
  provider: ProviderConfig | null
  format: ContentConfig | null
  contentPath: string
  media: MediaSettings
}

const settings = JSON.parse(__FORGEPRESS_SETTINGS__) as Settings

export const local = settings.local
export const devServer = settings.devServer
export const provider = settings.provider
export const format = settings.format
export const contentPath = settings.contentPath
export const media = settings.media
