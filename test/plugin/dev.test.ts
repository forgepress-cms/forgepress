import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '../../src/config/resolve'
import { createDevContent } from '../../src/plugin/dev'

const builds = vi.hoisted(() => [] as (() => void)[])

vi.mock('../../src/disk/output', () => ({
  buildOutput: vi.fn(() => new Promise((resolve) => {
    builds.push(() => resolve({ issues: [] }))
  })),
}))

const root = fileURLToPath(new URL('../../node_modules/.forgepress-dev-test', import.meta.url))
const config = resolveConfig()
const entry = join(root, config.paths.content, 'author/alice.ts')

function dev(reload: () => void) {
  return createDevContent(root, config, { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, reload)
}

afterEach(() => {
  builds.length = 0
  vi.useRealTimers()
})

describe('dev content', () => {
  it('rebuilds once for a burst of changes, and never while a rebuild is still writing', async () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const content = dev(reload)

    content.changed(entry)
    content.changed(entry)
    await vi.advanceTimersByTimeAsync(100)

    expect(builds).toHaveLength(1)

    content.changed(entry)
    await vi.advanceTimersByTimeAsync(1000)

    expect(builds).toHaveLength(1)
    expect(reload).not.toHaveBeenCalled()

    builds[0]?.()
    await vi.advanceTimersByTimeAsync(0)

    expect(reload).toHaveBeenCalledOnce()
    expect(builds).toHaveLength(2)

    builds[1]?.()
    await vi.advanceTimersByTimeAsync(0)

    expect(reload).toHaveBeenCalledTimes(2)
    expect(builds).toHaveLength(2)
  })

  it('writes the output at startup without reloading, and waits for it', async () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    let written = false
    const refreshed = dev(reload).refresh().then(() => {
      written = true
    })

    await vi.advanceTimersByTimeAsync(100)
    expect(builds).toHaveLength(1)
    expect(written).toBe(false)

    builds[0]?.()
    await refreshed

    expect(written).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })
})
