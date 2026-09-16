import type { AuthorizationServer, Client, TokenEndpointRequestOptions, TokenEndpointResponse } from 'oauth4webapi'
import type { ProviderConfig } from '../config/types'
import type { OAuthEndpoints, OAuthTokens, TokenGetter } from './types'
import { allowInsecureRequests, authorizationCodeGrantRequest, AuthorizationResponseError, None, processAuthorizationCodeResponse, processRefreshTokenResponse, refreshTokenGrantRequest, ResponseBodyError, validateAuthResponse } from 'oauth4webapi'
import { describe } from './providers'

export { calculatePKCECodeChallenge as createChallenge, generateRandomState as createState, generateRandomCodeVerifier as createVerifier } from 'oauth4webapi'

const SKEW = 30_000

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

export function toTokens(response: TokenEndpointResponse, now = Date.now()): OAuthTokens {
  return {
    access: response.access_token,
    ...response.refresh_token ? { refresh: response.refresh_token } : {},
    ...response.expires_in === undefined ? {} : { expires: now + response.expires_in * 1000 },
  }
}

export function expired(tokens: OAuthTokens, now = Date.now()): boolean {
  return tokens.expires !== undefined && tokens.expires - SKEW <= now
}

function server(endpoints: OAuthEndpoints): AuthorizationServer {
  return { issuer: endpoints.issuer, authorization_endpoint: endpoints.authorize, token_endpoint: endpoints.token }
}

function requestOptions(endpoints: OAuthEndpoints): TokenEndpointRequestOptions {
  return { [allowInsecureRequests]: new URL(endpoints.token).protocol === 'http:' }
}

function refusal(error: unknown): unknown {
  if (error instanceof AuthorizationResponseError)
    return new Error(`[forgepress] the forge refused the sign-in: ${error.error_description || error.error}`, { cause: error })

  if (error instanceof ResponseBodyError)
    return new Error(`[forgepress] the forge rejected the token request: ${error.error_description || error.error}`, { cause: error })

  return error
}

export async function exchange(endpoints: OAuthEndpoints, clientId: string, redirectUri: string, callback: URLSearchParams, state: string, verifier: string): Promise<OAuthTokens> {
  const as = server(endpoints)
  const client: Client = { client_id: clientId }

  try {
    const params = validateAuthResponse(as, client, callback, state)
    const response = await authorizationCodeGrantRequest(as, client, None(), params, redirectUri, verifier, requestOptions(endpoints))

    return toTokens(await processAuthorizationCodeResponse(as, client, response))
  }
  catch (error) {
    throw refusal(error)
  }
}

export async function renew(endpoints: OAuthEndpoints, clientId: string, refresh: string): Promise<OAuthTokens> {
  const as = server(endpoints)
  const client: Client = { client_id: clientId }

  try {
    const response = await refreshTokenGrantRequest(as, client, None(), refresh, requestOptions(endpoints))

    return toTokens(await processRefreshTokenResponse(as, client, response))
  }
  catch (error) {
    throw refusal(error)
  }
}

export function storedTokens(value: OAuthTokens | string | undefined): OAuthTokens | undefined {
  if (typeof value === 'string')
    return value ? { access: value } : undefined

  return value
}

export async function refreshed(tokens: OAuthTokens, config: ProviderConfig): Promise<OAuthTokens> {
  const oauth = describe(config).oauth

  if (!expired(tokens) || !tokens.refresh || !oauth || !config.clientId)
    return tokens

  return renew(oauth, config.clientId, tokens.refresh)
}

export function createTokenGetter(config: ProviderConfig, read: () => Promise<OAuthTokens>, write: (tokens: OAuthTokens) => Promise<void>): TokenGetter {
  let renewal: Promise<OAuthTokens> | undefined

  async function renewed(tokens: OAuthTokens): Promise<OAuthTokens> {
    const next = await refreshed(tokens, config)

    if (next !== tokens)
      await write(next)

    return next
  }

  return async () => {
    const tokens = await read()

    if (!expired(tokens))
      return tokens.access

    renewal ??= renewed(tokens).finally(() => {
      renewal = undefined
    })

    return (await renewal).access
  }
}
