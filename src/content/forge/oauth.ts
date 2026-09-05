import type { OAuthEndpoints, OAuthTokens } from '../../types/content/forge'

const ENTROPY = 32
const SKEW = 30_000

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function random(): string {
  const bytes = new Uint8Array(ENTROPY)

  crypto.getRandomValues(bytes)

  return base64url(bytes.buffer)
}

export function createVerifier(): string {
  return random()
}

export function createState(): string {
  return random()
}

export async function createChallenge(verifier: string): Promise<string> {
  return base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
}

export interface AuthorizeRequest {
  clientId: string
  redirectUri: string
  scopes: readonly string[]
  state: string
  challenge: string
}

export function authorizeUrl(endpoints: OAuthEndpoints, request: AuthorizeRequest): string {
  const params = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: 'code',
    state: request.state,
    code_challenge: request.challenge,
    code_challenge_method: 'S256',
  })

  if (request.scopes.length > 0)
    params.set('scope', request.scopes.join(' '))

  return `${endpoints.authorize}?${params.toString()}`
}

export function toTokens(payload: Record<string, unknown>, now = Date.now()): OAuthTokens {
  const access = payload.access_token

  if (typeof access !== 'string' || !access)
    throw new Error('[webenv] the forge returned no access token')

  const refresh = payload.refresh_token
  const expires = payload.expires_in

  return {
    access,
    ...typeof refresh === 'string' && refresh ? { refresh } : {},
    ...typeof expires === 'number' ? { expires: now + expires * 1000 } : {},
  }
}

export function expired(tokens: OAuthTokens, now = Date.now()): boolean {
  return tokens.expires !== undefined && tokens.expires - SKEW <= now
}

async function form(endpoints: OAuthEndpoints, body: Record<string, string>): Promise<OAuthTokens> {
  const response = await fetch(endpoints.token, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  if (!response.ok)
    throw new Error(`[webenv] the forge rejected the token request (${response.status}): ${(await response.text()).slice(0, 200)}`)

  return toTokens(await response.json() as Record<string, unknown>)
}

export function exchange(endpoints: OAuthEndpoints, clientId: string, redirectUri: string, code: string, verifier: string): Promise<OAuthTokens> {
  return form(endpoints, {
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })
}

export function renew(endpoints: OAuthEndpoints, clientId: string, refresh: string): Promise<OAuthTokens> {
  return form(endpoints, {
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  })
}
