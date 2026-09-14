import type { ProviderConfig } from '../../src/types/config'
import { expect, describe as group, it } from 'vitest'
import { describe as descriptor } from '../../src/forge/providers'

function config(partial: Partial<ProviderConfig> = {}): ProviderConfig {
  return { type: 'gitlab', repository: { owner: 'acme', name: 'site' }, ...partial }
}

group('provider descriptors', () => {
  it('sends GitHub to its separate API host and offers no OAuth', () => {
    const found = descriptor(config({ type: 'github' }))

    expect(found.api).toBe('https://api.github.com')
    expect(found.oauth).toBeUndefined()
  })

  it('uses the enterprise API path for a self-hosted GitHub', () => {
    expect(descriptor(config({ type: 'github', url: 'https://git.acme.com' })).api).toBe('https://git.acme.com/api/v3')
  })

  it('gives GitLab v4 endpoints and OAuth', () => {
    const found = descriptor(config())

    expect(found.api).toBe('https://gitlab.com/api/v4')
    expect(found.oauth).toEqual({ authorize: 'https://gitlab.com/oauth/authorize', token: 'https://gitlab.com/oauth/token' })
  })

  it('gives Forgejo v1 endpoints and OAuth', () => {
    const found = descriptor(config({ type: 'forgejo' }))

    expect(found.api).toBe('https://codeberg.org/api/v1')
    expect(found.oauth?.token).toBe('https://codeberg.org/login/oauth/access_token')
  })

  it('honours a self-hosted instance and trims trailing slashes', () => {
    expect(descriptor(config({ url: 'https://gitlab.acme.com/' })).api).toBe('https://gitlab.acme.com/api/v4')
  })

  it('lets configured scopes override the defaults', () => {
    expect(descriptor(config({ scopes: ['read_api'] })).scopes).toEqual(['read_api'])
    expect(descriptor(config()).scopes).toEqual(['api'])
  })

  it('names the forge and where to create a token', () => {
    expect(descriptor(config({ type: 'github' }))).toMatchObject({ name: 'GitHub', tokens: 'https://github.com/settings/personal-access-tokens/new' })
    expect(descriptor(config({ url: 'https://gitlab.acme.com/' }))).toMatchObject({ name: 'GitLab', tokens: 'https://gitlab.acme.com/-/user_settings/personal_access_tokens' })
    expect(descriptor(config({ type: 'forgejo', url: 'http://127.0.0.1:3310' }))).toMatchObject({ name: 'Forgejo', tokens: 'http://127.0.0.1:3310/user/settings/applications' })
  })
})
