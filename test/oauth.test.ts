import type { ProviderConfig } from '../src/types/config'
import { expect, describe as group, it } from 'vitest'
import { describe as descriptor } from '../src/forge'
import { authorizeUrl, createChallenge, createVerifier, expired, toTokens } from '../src/forge/oauth'

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
})

group('pkce', () => {
  it('matches the RFC 7636 challenge vector', async () => {
    const challenge = await createChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generates url-safe verifiers of a legal length', () => {
    const verifier = createVerifier()

    expect(verifier).toMatch(/^[\w-]+$/)
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
  })

  it('does not repeat verifiers', () => {
    expect(new Set(Array.from({ length: 50 }, createVerifier)).size).toBe(50)
  })

  it('builds an authorize url with S256 and the requested scopes', () => {
    const url = new URL(authorizeUrl(
      { authorize: 'https://gitlab.com/oauth/authorize', token: 'https://gitlab.com/oauth/token' },
      { clientId: 'abc', redirectUri: 'https://site.test/admin/', scopes: ['api'], state: 'xyz', challenge: 'chal' },
    ))

    expect(url.origin + url.pathname).toBe('https://gitlab.com/oauth/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'abc',
      redirect_uri: 'https://site.test/admin/',
      response_type: 'code',
      state: 'xyz',
      code_challenge: 'chal',
      code_challenge_method: 'S256',
      scope: 'api',
    })
  })
})

group('tokens', () => {
  it('reads an access token and turns the lifetime into an instant', () => {
    expect(toTokens({ access_token: 'a', refresh_token: 'r', expires_in: 7200 }, 1000)).toEqual({
      access: 'a',
      refresh: 'r',
      expires: 1000 + 7_200_000,
    })
  })

  it('accepts a response with no refresh or expiry', () => {
    expect(toTokens({ access_token: 'a' })).toEqual({ access: 'a' })
  })

  it('rejects a response with no access token', () => {
    expect(() => toTokens({ error: 'invalid_grant' })).toThrow('no access token')
  })

  it('treats a token without an expiry as good', () => {
    expect(expired({ access: 'a' })).toBe(false)
  })

  it('expires a token early enough to beat clock skew', () => {
    expect(expired({ access: 'a', expires: 100_000 }, 60_000)).toBe(false)
    expect(expired({ access: 'a', expires: 100_000 }, 80_000)).toBe(true)
  })
})
