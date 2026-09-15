// @vitest-environment happy-dom
import type { BuildCheck, Forge } from '../../../src/forge/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let saved: unknown
let deployed: { commit: string | null, dev?: true } | undefined
let checks: BuildCheck[] = []
let forge: Forge | undefined
const asked: string[] = []

vi.doMock('../../../src/storage', () => ({
  persist: () => ({
    read: async () => saved,
    write: async (value: unknown) => {
      saved = value
    },
    clear: async () => {
      saved = undefined
    },
  }),
}))

vi.doMock('../../../src/editor/composables/useSession', () => ({
  useSession: () => ({ forge: () => forge }),
}))

vi.doMock('../../../src/query/fetch', () => ({
  reader: async () => deployed,
}))

async function load() {
  vi.resetModules()

  return (await import('../../../src/editor/composables/useBuild')).useBuild()
}

function settle(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

async function wait(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await settle()
}

function visibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

  saved = undefined
  deployed = { commit: 'c0' }
  checks = []
  asked.length = 0
  visibility('visible')

  forge = {
    access: async () => {
      throw new Error('not used')
    },
    head: async () => 'c1',
    files: async () => [],
    read: async () => '',
    commit: async () => 'c1',
    checks: async (commit) => {
      asked.push(commit)

      return checks
    },
    contains: async (commit, ancestor) => commit === 'c2' && ancestor === 'c1',
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('build status', () => {
  it('watches a published commit until the site shows it, then forgets it', async () => {
    const build = await load()

    checks = [{ name: 'build', state: 'pending' }]
    await build.track('c1')
    await settle()

    expect(build.state.value).toBe('building')
    expect(build.checks.value).toEqual([{ name: 'build', state: 'pending' }])
    expect(saved).toMatchObject({ commit: 'c1' })

    checks = [{ name: 'build', state: 'success' }]
    await wait(15_000)

    expect(build.state.value).toBe('building')

    deployed = { commit: 'c2' }
    await wait(15_000)

    expect(build.state.value).toBe('live')
    expect(saved).toBeUndefined()

    await wait(60_000)

    expect(asked).toEqual(['c1', 'c1', 'c1'])
  })

  it('keeps a failed build across reloads until it is dismissed', async () => {
    const first = await load()

    checks = [{ name: 'build', state: 'failure', url: 'https://ci.acme.com/1' }]
    await first.track('c1')
    await settle()

    expect(first.state.value).toBe('failed')

    await wait(60_000)
    expect(asked).toEqual(['c1'])

    const second = await load()

    await second.restore()

    expect(second.commit.value).toBe('c1')
    expect(second.state.value).toBe('failed')
    expect(second.checks.value).toEqual([{ name: 'build', state: 'failure', url: 'https://ci.acme.com/1' }])

    await second.dismiss()

    expect(second.state.value).toBeUndefined()
    expect(second.commit.value).toBe('')
    expect(saved).toBeUndefined()
  })

  it('gives up after half an hour and starts over when asked to check again', async () => {
    const build = await load()

    await build.track('c1')
    await settle()
    await wait(30 * 60_000)

    expect(build.state.value).toBe('stalled')

    const polls = asked.length

    await wait(60_000)
    expect(asked).toHaveLength(polls)

    checks = [{ name: 'build', state: 'pending' }]
    await build.retry()
    await settle()

    expect(build.state.value).toBe('building')
    expect(asked).toHaveLength(polls + 1)
  })

  it('calls the site built when its index doesn\'t name a commit', async () => {
    const build = await load()

    deployed = { commit: null }
    checks = [{ name: 'build', state: 'success' }]
    await build.track('c1')
    await settle()

    expect(build.state.value).toBe('passed')
    expect(saved).toBeUndefined()
  })

  it('asks nothing while the tab is hidden or nobody is signed in, and goes on after signing in', async () => {
    const build = await load()

    checks = [{ name: 'build', state: 'pending' }]
    await build.track('c1')
    await settle()

    visibility('hidden')
    await wait(45_000)

    expect(asked).toEqual(['c1'])

    visibility('visible')
    await wait(15_000)

    expect(asked).toEqual(['c1', 'c1'])

    const signedIn = forge

    forge = undefined
    await wait(45_000)

    expect(asked).toEqual(['c1', 'c1'])
    expect(build.state.value).toBe('building')

    forge = signedIn
    await build.restore()

    expect(asked).toEqual(['c1', 'c1', 'c1'])
  })
})
