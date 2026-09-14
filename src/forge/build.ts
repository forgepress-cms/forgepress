import type { BuildCheck, Forge } from './types'
import { errorMessage } from '../utils/error'

export type BuildState = 'building' | 'passed' | 'live' | 'failed' | 'stalled'

export type Deployed = () => Promise<string | null | undefined>

export interface BuildReport {
  state: BuildState
  checks: BuildCheck[]
  error: string
}

export type BuildReader = (forge: Forge, commit: string, expired: boolean) => Promise<BuildReport>

export function buildState(checks: readonly BuildCheck[], live: boolean | undefined, expired: boolean): BuildState {
  if (live)
    return 'live'

  if (checks.some(check => check.state === 'failure'))
    return 'failed'

  if (live === undefined && checks.some(check => check.state === 'success') && checks.every(check => check.state !== 'pending'))
    return 'passed'

  return expired ? 'stalled' : 'building'
}

export function createBuildReader(deployed: Deployed): BuildReader {
  const known = new Map<string, Promise<boolean>>()

  function contains(forge: Forge, current: string, commit: string): Promise<boolean> {
    const key = `${current}...${commit}`
    let pending = known.get(key)

    if (!pending) {
      pending = forge.contains(current, commit)
      known.set(key, pending)
      pending.catch(() => known.delete(key))
    }

    return pending.catch(() => false)
  }

  async function live(forge: Forge, commit: string): Promise<boolean | undefined> {
    const current = await deployed().catch(() => undefined)

    if (typeof current !== 'string')
      return undefined

    return current === commit || contains(forge, current, commit)
  }

  return async (forge, commit, expired) => {
    const [isLive, found] = await Promise.all([
      live(forge, commit),
      forge.checks(commit).then(checks => ({ checks, error: '' }), (cause: unknown) => ({ checks: [], error: errorMessage(cause) })),
    ])

    return { state: buildState(found.checks, isLive, expired), checks: found.checks, error: found.error }
  }
}
