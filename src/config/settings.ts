import type { ResolvedMedia } from '../media/types'
import type { ResolvedConfig } from './resolve'
import type { ContentConfig, ProviderConfig } from './types'

export interface EditorSettings {
  local: boolean
  devServer: string
  provider?: ProviderConfig | undefined
  format?: ContentConfig | undefined
  contentPath: string
  media: ResolvedMedia
}

export function editorSettings(local: boolean, config: ResolvedConfig, devServer = ''): EditorSettings {
  return {
    local,
    devServer,
    provider: config.provider,
    format: config.content,
    contentPath: config.paths.dir,
    media: config.media,
  }
}
