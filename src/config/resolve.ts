import type { ContentPaths } from '../files/paths'
import type { ResolvedMedia } from '../media'
import type { ResolvedOutput } from '../output'
import type { ContentConfig, ForgePressConfig, ProviderConfig } from '../types/config'
import { createPaths, prefixer } from '../files/paths'
import { resolveMedia } from '../media'
import { resolveOutput } from '../output'

export interface ResolvedConfig {
  paths: ContentPaths
  media: ResolvedMedia
  output: ResolvedOutput
  content: ContentConfig | undefined
  provider: ProviderConfig | undefined
}

function checkRepositoryPath(label: string, path: string, provider: ProviderConfig): void {
  try {
    prefixer(provider.base)(path)
  }
  catch {
    const project = provider.base ? `provider.base ${JSON.stringify(provider.base)}` : 'the root of the repository'

    throw new Error(`[forgepress] the ${label} ${JSON.stringify(path)} is outside the repository when the project is at ${project}. Set provider.base to the folder of this project in the repository`)
  }
}

export function resolveConfig(config?: ForgePressConfig): ResolvedConfig {
  const paths = createPaths(config?.path)
  const media = resolveMedia(config?.media)

  if (config?.provider) {
    checkRepositoryPath('content folder', paths.dir, config.provider)
    checkRepositoryPath('media folder', media.dir, config.provider)
  }

  return {
    paths,
    media,
    output: resolveOutput(config?.output),
    content: config?.content,
    provider: config?.provider,
  }
}
