import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '../../src/config/resolve'
import { ENDPOINT } from '../../src/endpoint/routes'
import { createDevContent } from '../../src/plugin/dev'

const builds = vi.hoisted(() => [] as (() => void)[])
const requests = vi.hoisted(() => [] as (() => void)[])

vi.mock('../../src/disk/output', () => ({
  buildOutput: vi.fn(() => new Promise((resolve) => {
    builds.push(() => resolve({ issues: [] }))
  })),
}))

vi.mock('../../src/plugin/endpoint', async original => ({
  ...await original<typeof import('../../src/plugin/endpoint')>(),
  handle: vi.fn(() => new Promise((resolve) => {
    requests.push(() => resolve(true))
  })),
}))

const root = fileURLToPath(new URL('../../node_modules/.forgepress-dev-test', import.meta.url))
const config = resolveConfig()
const entry = join(root, config.paths.content, 'author/alice.ts')

function dev(reload: () => void) {
  return createDevContent(root, config, { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, reload)
}

function store(text: string): void {
  mkdirSync(dirname(entry), { recursive: true })
  writeFileSync(entry, text)
}

async function started(count: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(100)
  await vi.waitFor(() => expect(builds).toHaveLength(count))
}

async function finish(count: number): Promise<void> {
  for (let built = 0; built < count; built++) {
    await started(1)
    builds.shift()?.()
    await vi.advanceTimersByTimeAsync(0)
  }
}

function post(content: ReturnType<typeof dev>): void {
  content.endpoint({ method: 'POST', url: `${ENDPOINT}/entry/author/alice` } as IncomingMessage, {} as ServerResponse, vi.fn())
}

beforeEach(() => {
  store('alice')
})

afterEach(() => {
  builds.length = 0
  requests.length = 0
  rmSync(root, { recursive: true, force: true })
  vi.useRealTimers()
})

describe('dev content', () => {
  it('rebuilds once for a burst of changes, and never while a rebuild is still writing', async () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const content = dev(reload)

    store('alice 1')
    content.changed(entry)
    content.changed(entry)
    await started(1)

    store('alice 2')
    content.changed(entry)
    await vi.advanceTimersByTimeAsync(1000)

    expect(builds).toHaveLength(1)
    expect(reload).not.toHaveBeenCalled()

    builds[0]?.()
    await vi.waitFor(() => expect(builds).toHaveLength(2))

    expect(reload).toHaveBeenCalledOnce()

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

    await started(1)
    expect(written).toBe(false)

    builds[0]?.()
    await refreshed

    expect(written).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads only when the schema or content files changed since the last reload', async () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const content = dev(reload)
    const refreshed = content.refresh()

    await finish(1)
    await refreshed

    content.changed(entry)
    await finish(1)

    expect(reload).not.toHaveBeenCalled()

    store('alice changed')
    content.changed(entry)
    await finish(1)

    expect(reload).toHaveBeenCalledOnce()

    content.changed(entry)
    await finish(1)

    expect(reload).toHaveBeenCalledOnce()
  })

  it('holds the reload until the editor has finished writing, then reloads once', async () => {
    vi.useFakeTimers()

    const reload = vi.fn()
    const content = dev(reload)
    const refreshed = content.refresh()

    await finish(1)
    await refreshed

    post(content)
    post(content)
    store('alice saved')
    content.changed(entry)
    await finish(1)

    expect(reload).not.toHaveBeenCalled()

    requests.shift()?.()
    await vi.advanceTimersByTimeAsync(1000)

    expect(builds).toHaveLength(0)
    expect(reload).not.toHaveBeenCalled()

    requests.shift()?.()
    await finish(1)

    expect(reload).toHaveBeenCalledOnce()

    content.changed(entry)
    await finish(1)

    expect(reload).toHaveBeenCalledOnce()
  })
})
