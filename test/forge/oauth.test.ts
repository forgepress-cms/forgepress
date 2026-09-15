import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeUrl, createChallenge, createVerifier, expired, refreshed, storedTokens, toTokens } from '../../src/forge/oauth'

describe('pkce', () => {
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

describe('tokens', () => {
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

describe('stored tokens', () => {
  const gitlab = { type: 'gitlab' as const, repository: { owner: 'acme', name: 'site' }, clientId: 'abc' }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads tokens saved as plain strings by earlier versions', () => {
    expect(storedTokens('a')).toEqual({ access: 'a' })
    expect(storedTokens('')).toBeUndefined()
    expect(storedTokens(undefined)).toBeUndefined()
    expect(storedTokens({ access: 'a', refresh: 'r' })).toEqual({ access: 'a', refresh: 'r' })
  })

  it('keeps tokens that are still good or can\'t be renewed', async () => {
    const good = { access: 'a', refresh: 'r', expires: Date.now() + 3_600_000 }
    const stale = { access: 'a', expires: Date.now() - 1000 }

    expect(await refreshed(good, gitlab)).toBe(good)
    expect(await refreshed(stale, gitlab)).toBe(stale)
    expect(await refreshed({ ...stale, refresh: 'r' }, { ...gitlab, type: 'github' })).toEqual({ ...stale, refresh: 'r' })
  })

  it('renews expired tokens with the refresh token', async () => {
    const requests: string[] = []

    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      requests.push(`${input} ${String(init.body)}`)

      return Response.json({ access_token: 'b', refresh_token: 's', expires_in: 7200 })
    })

    const renewed = await refreshed({ access: 'a', refresh: 'r', expires: Date.now() - 1000 }, gitlab)

    expect(renewed).toMatchObject({ access: 'b', refresh: 's' })
    expect(requests).toEqual(['https://gitlab.com/oauth/token client_id=abc&grant_type=refresh_token&refresh_token=r'])
  })
})
