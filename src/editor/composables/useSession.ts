import type { Ref } from 'vue'
import type { Forge, ForgeIdentity, OAuthTokens } from '../../forge/types'
import type { ProviderConfig } from '../../types/config'
import { computed, ref, shallowRef } from 'vue'
import { describe } from '../../forge'
import { createForgejoForge } from '../../forge/forgejo'
import { createGitHubForge } from '../../forge/github'
import { createGitLabForge } from '../../forge/gitlab'
import { authorizeUrl, createChallenge, createState, createVerifier, exchange, expired, renew } from '../../forge/oauth'
import { baked } from '../../store/bundle'
import { persist, repositoryCache } from '../storage'

const PKCE = 'forgepress:pkce'

export interface Session {
  identity: Ref<ForgeIdentity | undefined>
  provider: Ref<ProviderConfig | undefined>
  branch: Ref<string>
  pending: Ref<boolean>
  error: Ref<string>
  redirects: Ref<boolean>
  restore: () => Promise<void>
  signIn: (token: string) => Promise<boolean>
  signInWithForge: () => Promise<void>
  signOut: () => Promise<void>
  forge: () => Forge | undefined
}

const identity = shallowRef<ForgeIdentity | undefined>()
const provider = shallowRef<ProviderConfig | undefined>()
const branch = ref('')
const pending = ref(false)
const error = ref('')

const store = persist<OAuthTokens | string>('token')
const cache = repositoryCache()

let tokens: OAuthTokens | undefined
let forge: Forge | undefined
let restored: Promise<void> | undefined

const redirects = computed(() => {
  const config = provider.value

  return config !== undefined && config.clientId !== undefined && describe(config).oauth !== undefined
})

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function redirectUri(config: ProviderConfig): string {
  return config.redirectUri ?? `${window.location.origin}${window.location.pathname}`
}

function build(config: ProviderConfig): Forge {
  if (config.type === 'gitlab')
    return createGitLabForge(config, current)

  if (config.type === 'forgejo')
    return createForgejoForge(config, current)

  return createGitHubForge(config, current)
}

async function current(): Promise<string> {
  if (!tokens)
    throw new Error('[forgepress] not signed in')

  const config = provider.value
  const oauth = config ? describe(config).oauth : undefined

  if (!expired(tokens) || !tokens.refresh || !oauth || !config?.clientId)
    return tokens.access

  tokens = await renew(oauth, config.clientId, tokens.refresh)

  await store.write(tokens)

  return tokens.access
}

async function adopt(next: OAuthTokens): Promise<boolean> {
  const config = provider.value

  if (!config) {
    error.value = 'No provider is configured in forgepress.config.mjs.'

    return false
  }

  pending.value = true
  error.value = ''

  const previous = tokens
  tokens = next

  try {
    const candidate = build(config)
    const access = await candidate.access()

    if (!access.writable) {
      error.value = `${access.identity.login} does not have write access to ${config.repository.owner}/${config.repository.name}.`
      tokens = previous

      return false
    }

    forge = candidate
    identity.value = access.identity
    branch.value = access.branch

    return true
  }
  catch (cause) {
    error.value = message(cause)
    tokens = previous

    return false
  }
  finally {
    pending.value = false
  }
}

const PATIENCE = 3000

function settled<TValue>(work: Promise<TValue>): Promise<TValue | undefined> {
  return Promise.race([
    work.catch(() => undefined),
    new Promise<undefined>(resolve => setTimeout(resolve, PATIENCE, undefined)),
  ])
}

function stored(value: OAuthTokens | string | undefined): OAuthTokens | undefined {
  if (typeof value === 'string')
    return value ? { access: value } : undefined

  return value
}

function clean(): void {
  const url = new URL(window.location.href)

  url.searchParams.delete('code')
  url.searchParams.delete('state')

  window.history.replaceState({}, '', url.toString())
}

async function complete(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')

  if (!code || !state)
    return false

  let saved: { verifier?: string, state?: string } = {}

  try {
    saved = JSON.parse(sessionStorage.getItem(PKCE) ?? '{}') as typeof saved
    sessionStorage.removeItem(PKCE)
  }
  catch {
  }

  clean()

  const config = provider.value
  const oauth = config ? describe(config).oauth : undefined

  if (!config?.clientId || !oauth)
    return false

  if (!saved.verifier || saved.state !== state) {
    error.value = 'Sign-in could not be verified. Please try again.'

    return false
  }

  pending.value = true

  try {
    return await adopt(await exchange(oauth, config.clientId, redirectUri(config), code, saved.verifier))
  }
  catch (cause) {
    error.value = message(cause)

    return false
  }
  finally {
    pending.value = false
  }
}

async function load(): Promise<void> {
  provider.value = (await baked()).provider

  if (await complete())
    return

  const saved = stored(await settled(store.read()))

  if (saved && !await adopt(saved))
    await store.clear().catch(() => undefined)
}

export function useSession(): Session {
  return {
    identity,
    provider,
    branch,
    pending,
    error,
    redirects,

    restore: () => {
      restored ??= load()

      return restored
    },

    signIn: async (token) => {
      const trimmed = token.trim()

      if (!trimmed) {
        error.value = 'Paste an access token to sign in.'

        return false
      }

      if (!await adopt({ access: trimmed }))
        return false

      await store.write({ access: trimmed })

      return true
    },

    signInWithForge: async () => {
      const config = provider.value
      const described = config ? describe(config) : undefined

      if (!config?.clientId || !described?.oauth) {
        error.value = 'This provider is not configured for OAuth sign-in.'

        return
      }

      error.value = ''

      const verifier = createVerifier()
      const state = createState()

      try {
        sessionStorage.setItem(PKCE, JSON.stringify({ verifier, state }))
      }
      catch {
        error.value = 'Sign-in needs session storage, which this browser blocked.'

        return
      }

      window.location.assign(authorizeUrl(described.oauth, {
        clientId: config.clientId,
        redirectUri: redirectUri(config),
        scopes: described.scopes,
        state,
        challenge: await createChallenge(verifier),
      }))
    },

    signOut: async () => {
      forge = undefined
      tokens = undefined
      identity.value = undefined
      branch.value = ''
      error.value = ''

      await store.clear().catch(() => undefined)
      await cache?.clear().catch(() => undefined)
    },

    forge: () => forge,
  }
}
