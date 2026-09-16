import type { OAuthTokens } from '../../src/forge/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeUrl, createChallenge, createTokenGetter, createVerifier, exchange, expired, refreshed, renew, storedTokens, toTokens } from '../../src/forge/oauth'

interface ForgeRequest {
  url: string
  body: Record<string, string>
}

function recorded(url: string, init: RequestInit): ForgeRequest {
  return { url, body: Object.fromEntries(new URLSearchParams(String(init.body))) }
}

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
      { issuer: 'https://gitlab.com', authorize: 'https://gitlab.com/oauth/authorize', token: 'https://gitlab.com/oauth/token' },
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
    expect(toTokens({ access_token: 'a', token_type: 'bearer', refresh_token: 'r', expires_in: 7200 }, 1000)).toEqual({
      access: 'a',
      refresh: 'r',
      expires: 1000 + 7_200_000,
    })
  })

  it('accepts a response with no refresh or expiry', () => {
    expect(toTokens({ access_token: 'a', token_type: 'bearer' })).toEqual({ access: 'a' })
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
    const requests: ForgeRequest[] = []

    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      requests.push(recorded(input, init))

      return Response.json({ access_token: 'b', token_type: 'Bearer', refresh_token: 's', expires_in: 7200 })
    })

    const renewed = await refreshed({ access: 'a', refresh: 'r', expires: Date.now() - 1000 }, gitlab)

    expect(renewed).toMatchObject({ access: 'b', refresh: 's' })
    expect(requests).toEqual([{ url: 'https://gitlab.com/oauth/token', body: { client_id: 'abc', grant_type: 'refresh_token', refresh_token: 'r' } }])
  })

  it('hands out a token that is still good without renewing it', async () => {
    const written: OAuthTokens[] = []
    const token = createTokenGetter(gitlab, async () => ({ access: 'a', refresh: 'r', expires: Date.now() + 3_600_000 }), async next => void written.push(next))

    expect(await token()).toBe('a')
    expect(written).toEqual([])
  })

  it('renews an expired token once for every request waiting on it and keeps the renewed tokens', async () => {
    let renewals = 0
    let tokens: OAuthTokens = { access: 'a', refresh: 'r', expires: Date.now() - 1000 }
    const written: OAuthTokens[] = []

    vi.stubGlobal('fetch', async () => {
      renewals += 1

      return Response.json({ access_token: `b${renewals}`, token_type: 'bearer', refresh_token: 's', expires_in: 7200 })
    })

    const token = createTokenGetter(gitlab, async () => tokens, async (next) => {
      tokens = next
      written.push(next)
    })

    expect(await Promise.all([token(), token(), token()])).toEqual(['b1', 'b1', 'b1'])
    expect(await token()).toBe('b1')
    expect(renewals).toBe(1)
    expect(written).toEqual([expect.objectContaining({ access: 'b1', refresh: 's' })])
  })
})

describe('forge answers', () => {
  const forgejo = { issuer: 'http://127.0.0.1:3310', authorize: 'http://127.0.0.1:3310/login/oauth/authorize', token: 'http://127.0.0.1:3310/login/oauth/access_token' }
  const redirect = 'http://localhost:3000/admin'

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exchanges the code of a sign-in for tokens, also with a forge on plain http', async () => {
    const requests: ForgeRequest[] = []

    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      requests.push(recorded(input, init))

      return Response.json({ access_token: 'a', token_type: 'bearer', refresh_token: 'r', expires_in: 3600 })
    })

    const tokens = await exchange(forgejo, 'editor', redirect, new URLSearchParams({ code: 'code', state: 'state' }), 'state', 'verifier')

    expect(tokens).toEqual({ access: 'a', refresh: 'r', expires: expect.any(Number) })
    expect(requests).toEqual([{ url: forgejo.token, body: { client_id: 'editor', grant_type: 'authorization_code', code: 'code', redirect_uri: redirect, code_verifier: 'verifier' } }])
  })

  it('explains a sign-in the forge refused, without asking for tokens', async () => {
    const fetch = vi.fn()

    vi.stubGlobal('fetch', fetch)

    await expect(exchange(forgejo, 'editor', redirect, new URLSearchParams({ error: 'access_denied', error_description: 'the request is denied', state: 'state' }), 'state', 'verifier'))
      .rejects
      .toThrow('[forgepress] the forge refused the sign-in: the request is denied')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('explains a token request the forge rejected', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: 'unauthorized_client', error_description: 'token was already used' }, { status: 400 }))

    await expect(renew(forgejo, 'editor', 'used')).rejects.toThrow('[forgepress] the forge rejected the token request: token was already used')
  })

  it('does not take a token response without an access token', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ token_type: 'bearer', expires_in: 3600 }))

    await expect(renew(forgejo, 'editor', 'r')).rejects.toThrow('"access_token"')
  })
})
