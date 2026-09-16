import type { BuildCheck, Forge } from './types'
import { errorMessage } from '../utils/error'
import { keyed } from '../utils/once'

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
  const known = keyed<boolean>()

  function contains(forge: Forge, current: string, commit: string): Promise<boolean> {
    return known(`${current}...${commit}`, () => forge.contains(current, commit)).catch(() => false)
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
