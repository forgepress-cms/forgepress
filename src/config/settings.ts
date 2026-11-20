import type { ContentConfig } from '../files'
import type { ProviderConfig } from '../forge'
import type { ResolvedMedia } from '../media'
import type { ResolvedConfig } from './resolve'

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
