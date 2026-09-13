import type { ForgePressConfig } from '../../types/config'
import type { ContentConfig } from '../../types/config/content'
import type { ProviderConfig } from '../../types/config/provider'
import type { ResolvedMedia } from '../media'
import type { ContentPaths } from '../paths'
import { resolveMedia } from '../media'
import { createPaths } from '../paths'

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
