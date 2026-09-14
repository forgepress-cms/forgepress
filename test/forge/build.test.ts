import type { BuildCheck, Forge } from '../../src/forge/types'
import { describe, expect, it } from 'vitest'
import { buildState, createBuildReader } from '../../src/forge/build'

function check(state: BuildCheck['state']): BuildCheck {
  return { name: state, state }
}

function forge(checks: () => Promise<BuildCheck[]>, contains: (commit: string, ancestor: string) => Promise<boolean> = async () => false) {
  const compared: string[] = []

  const client: Forge = {
    access: async () => {
      throw new Error('not used')
    },
    head: async () => 'c1',
    files: async () => [],
    read: async () => '',
    commit: async () => 'c1',
    checks,
    contains: async (commit, ancestor) => {
      compared.push(`${commit}...${ancestor}`)

      return contains(commit, ancestor)
    },
  }

  return { client, compared }
}

describe('build state', () => {
  it('is live as soon as the site shows the commit, whatever the checks say', () => {
    expect(buildState([check('failure'), check('pending')], true, true)).toBe('live')
  })

  it('fails when any check failed', () => {
    expect(buildState([check('success'), check('failure')], false, false)).toBe('failed')
    expect(buildState([check('failure')], undefined, true)).toBe('failed')
  })

  it('counts finished checks as built only when the site can\'t tell what it shows', () => {
    expect(buildState([check('success'), check('skipped')], undefined, false)).toBe('passed')
    expect(buildState([check('success')], false, false)).toBe('building')
    expect(buildState([check('success'), check('pending')], undefined, false)).toBe('building')
    expect(buildState([check('skipped')], undefined, false)).toBe('building')
    expect(buildState([], undefined, false)).toBe('building')
  })

  it('stalls when nothing finished in time', () => {
    expect(buildState([], undefined, true)).toBe('stalled')
    expect(buildState([check('pending')], false, true)).toBe('stalled')
    expect(buildState([check('success')], false, true)).toBe('stalled')
  })
})

describe('build reader', () => {
  it('is live when the site was built from the commit, without comparing', async () => {
    const { client, compared } = forge(async () => [check('pending')])
    const read = createBuildReader(async () => 'c1')

    expect(await read(client, 'c1', false)).toEqual({ state: 'live', checks: [check('pending')], error: '' })
    expect(compared).toEqual([])
  })

  it('asks the forge once whether the commit the site shows contains the published one', async () => {
    let deployed = 'c0'
    const { client, compared } = forge(async () => [check('success')], async commit => commit === 'c2')
    const read = createBuildReader(async () => deployed)

    expect((await read(client, 'c1', false)).state).toBe('building')
    expect((await read(client, 'c1', false)).state).toBe('building')

    deployed = 'c2'

    expect((await read(client, 'c1', false)).state).toBe('live')
    expect((await read(client, 'c1', false)).state).toBe('live')
    expect(compared).toEqual(['c0...c1', 'c2...c1'])
  })

  it('compares again after a comparison failed', async () => {
    let failing = true
    const { client, compared } = forge(async () => [], async () => {
      if (failing)
        throw new Error('GitHub 502')

      return true
    })
    const read = createBuildReader(async () => 'c2')

    expect((await read(client, 'c1', false)).state).toBe('building')

    failing = false

    expect((await read(client, 'c1', false)).state).toBe('live')
    expect(compared).toEqual(['c2...c1', 'c2...c1'])
  })

  it('can\'t tell whether the site is live when its index is missing, from development or has no commit', async () => {
    const { client } = forge(async () => [check('success')])

    for (const deployed of [async () => undefined, async () => null, async () => Promise.reject(new Error('offline'))])
      expect((await createBuildReader(deployed)(client, 'c1', false)).state).toBe('passed')
  })

  it('keeps reading the site when the checks can\'t be read', async () => {
    const { client } = forge(async () => {
      throw new Error('[forgepress] GitHub 401: Bad credentials')
    })

    expect(await createBuildReader(async () => 'c1')(client, 'c1', false)).toEqual({ state: 'live', checks: [], error: '[forgepress] GitHub 401: Bad credentials' })
    expect(await createBuildReader(async () => 'c0')(client, 'c1', true)).toEqual({ state: 'stalled', checks: [], error: '[forgepress] GitHub 401: Bad credentials' })
  })
})
