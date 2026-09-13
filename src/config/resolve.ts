import type { ContentPaths } from '../files/paths'
import type { ResolvedMedia } from '../media'
import type { ContentConfig, ForgePressConfig, ProviderConfig } from '../types/config'
import { createPaths } from '../files/paths'
import { resolveMedia } from '../media'

export interface ResolvedConfig {
  paths: ContentPaths
  media: ResolvedMedia
  content: ContentConfig | undefined
  provider: ProviderConfig | undefined
}

export function resolveConfig(config?: ForgePressConfig): ResolvedConfig {
  return {
    paths: createPaths(config?.path),
    media: resolveMedia(config?.media),
    content: config?.content,
    provider: config?.provider,
  }
}
