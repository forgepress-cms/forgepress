import type { Forge, ProviderConfig, TokenGetter } from './types'
import { createForgejoForge } from './clients/forgejo'
import { createGitHubForge } from './clients/github'
import { createGitLabForge } from './clients/gitlab'

export function createForge(config: ProviderConfig, token: TokenGetter): Forge {
  if (config.type === 'gitlab')
    return createGitLabForge(config, token)

  if (config.type === 'forgejo')
    return createForgejoForge(config, token)

  return createGitHubForge(config, token)
}
