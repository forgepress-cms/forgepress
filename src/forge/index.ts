import type { ProviderConfig } from '../types/config'
import type { Forge, TokenGetter } from './types'
import { createForgejoForge } from './forgejo'
import { createGitHubForge } from './github'
import { createGitLabForge } from './gitlab'

export function createForge(config: ProviderConfig, token: TokenGetter): Forge {
  if (config.type === 'gitlab')
    return createGitLabForge(config, token)

  if (config.type === 'forgejo')
    return createForgejoForge(config, token)

  return createGitHubForge(config, token)
}
