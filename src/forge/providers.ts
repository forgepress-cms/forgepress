import type { ProviderConfig, ProviderType } from '../types/config'
import type { ForgeDescriptor } from './types'

interface Provider {
  name: string
  root: string
  tokens: string
}

const PROVIDERS: Record<ProviderType, Provider> = {
  github: { name: 'GitHub', root: 'https://github.com', tokens: '/settings/personal-access-tokens/new' },
  gitlab: { name: 'GitLab', root: 'https://gitlab.com', tokens: '/-/user_settings/personal_access_tokens' },
  forgejo: { name: 'Forgejo', root: 'https://codeberg.org', tokens: '/user/settings/applications' },
}

export function describe(config: ProviderConfig): ForgeDescriptor {
  const provider = PROVIDERS[config.type]
  const root = (config.url ?? provider.root).replace(/\/+$/, '')
  const shared = { name: provider.name, root, tokens: `${root}${provider.tokens}` }

  if (config.type === 'github') {
    return {
      ...shared,
      api: root === PROVIDERS.github.root ? 'https://api.github.com' : `${root}/api/v3`,
      scopes: config.scopes ?? [],
    }
  }

  if (config.type === 'gitlab') {
    return {
      ...shared,
      api: `${root}/api/v4`,
      scopes: config.scopes ?? ['api'],
      oauth: { authorize: `${root}/oauth/authorize`, token: `${root}/oauth/token` },
    }
  }

  return {
    ...shared,
    api: `${root}/api/v1`,
    scopes: config.scopes ?? ['read:user', 'write:repository'],
    oauth: { authorize: `${root}/login/oauth/authorize`, token: `${root}/login/oauth/access_token` },
  }
}
