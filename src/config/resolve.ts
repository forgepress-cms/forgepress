import type { ContentPaths } from '../files/paths'
import type { ResolvedMedia } from '../media'
import type { ResolvedOutput } from '../output'
import type { ContentConfig, ForgePressConfig, ProviderConfig } from '../types/config'
import { createPaths } from '../files/paths'
import { resolveMedia } from '../media'
import { resolveOutput } from '../output'

export interface ResolvedConfig {
  paths: ContentPaths
  media: ResolvedMedia
  output: ResolvedOutput
  content: ContentConfig | undefined
  provider: ProviderConfig | undefined
}

export function resolveConfig(config?: ForgePressConfig): ResolvedConfig {
  return {
    paths: createPaths(config?.path),
    media: resolveMedia(config?.media),
    output: resolveOutput(config?.output),
    content: config?.content,
    provider: config?.provider,
  }
}
