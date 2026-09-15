import type { ResolvedConfig } from '../config/resolve'
import type { ResolvedMedia } from '../media'
import type { ContentConfig, ProviderConfig } from '../types/config'

export const SETTINGS_ID = 'virtual:forgepress/settings'

export interface EditorSettings {
  local: boolean
  devServer: string
  provider: ProviderConfig | null
  format: ContentConfig | null
  contentPath: string
  media: ResolvedMedia
}

export function resolved(id: string): string {
  return `\0${id}`
}

export function editorSettings(local: boolean, config: ResolvedConfig, devServer = ''): EditorSettings {
  return {
    local,
    devServer,
    provider: config.provider ?? null,
    format: config.content ?? null,
    contentPath: config.paths.dir,
    media: config.media,
  }
}

export function generateSettings(local: boolean, config: ResolvedConfig): string {
  return `${Object.entries(editorSettings(local, config)).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)}`).join('\n')}\n`
}
