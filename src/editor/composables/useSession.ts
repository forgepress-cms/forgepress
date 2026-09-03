import type { Ref } from 'vue'
import type { ProviderConfig } from '../../types/config/provider'
import type { Forge, ForgeIdentity } from '../../types/content/forge'
import { ref, shallowRef } from 'vue'
import { createGitHubForge } from '../../content/forge/github'
import { bakedProvider } from '../../content/source'
import { persist } from '../../content/store'

export interface Session {
  identity: Ref<ForgeIdentity | undefined>
  provider: Ref<ProviderConfig | undefined>
  branch: Ref<string>
  pending: Ref<boolean>
  error: Ref<string>
  restore: () => Promise<void>
  signIn: (token: string) => Promise<boolean>
  signOut: () => Promise<void>
  forge: () => Forge | undefined
}

const identity = shallowRef<ForgeIdentity | undefined>()
const provider = shallowRef<ProviderConfig | undefined>()
const branch = ref('')
const pending = ref(false)
const error = ref('')

const tokens = persist<string>('token')

let forge: Forge | undefined
let restored: Promise<void> | undefined

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function create(config: ProviderConfig, token: string): Forge {
  if (config.type !== 'github')
    throw new Error(`[webenv] the ${config.type} provider is not implemented yet`)

  return createGitHubForge(config, () => token)
}

async function connect(token: string): Promise<boolean> {
  const config = provider.value

  if (!config) {
    error.value = '[webenv] no provider is configured in webenv.config.mjs'

    return false
  }

  pending.value = true
  error.value = ''

  try {
    const candidate = create(config, token)
    const access = await candidate.access()

    if (!access.writable) {
      error.value = `${access.identity.login} cannot write to ${config.repository.owner}/${config.repository.name}`

      return false
    }

    forge = candidate
    identity.value = access.identity
    branch.value = access.branch

    return true
  }
  catch (cause) {
    error.value = message(cause)

    return false
  }
  finally {
    pending.value = false
  }
}

async function stored(): Promise<string | undefined> {
  try {
    return await tokens.read()
  }
  catch {
    return undefined
  }
}

async function load(): Promise<void> {
  provider.value = await bakedProvider() ?? undefined

  const token = await stored()

  if (token && !await connect(token))
    await tokens.clear().catch(() => undefined)
}

export function useSession(): Session {
  return {
    identity,
    provider,
    branch,
    pending,
    error,

    restore: () => {
      restored ??= load()

      return restored
    },

    signIn: async (token) => {
      const trimmed = token.trim()

      if (!trimmed) {
        error.value = 'Paste an access token to sign in'

        return false
      }

      if (!await connect(trimmed))
        return false

      await tokens.write(trimmed)

      return true
    },

    signOut: async () => {
      forge = undefined
      identity.value = undefined
      branch.value = ''
      error.value = ''

      await tokens.clear()
    },

    forge: () => forge,
  }
}
