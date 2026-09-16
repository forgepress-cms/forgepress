// @vitest-environment happy-dom
import type { PreviewSettings } from '../../src/preview/state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settle } from '../settle'

const settings: PreviewSettings = {
  provider: { type: 'forgejo', url: 'http://127.0.0.1:3310', repository: { owner: 'fred', name: 'site' } },
  contentPath: '.forgepress',
  mediaUrl: '/uploads',
}

let builds = 0
let failure: Error | undefined

vi.doMock('../../src/preview/reader', () => ({
  createPreviewReader: () => ({
    build: async () => {
      builds += 1

      if (failure)
        throw failure

      return new Map([['index.json', JSON.stringify({ version: 1, commit: null, build: builds })]])
    },
  }),
}))

async function load() {
  vi.resetModules()

  const preview = await import('../../src/preview')
  const state = await import('../../src/preview/state')
  const { overlaid } = await import('../../src/query/overlay')
  const published: string[] = []
  const reader = overlaid(async (path) => {
    published.push(path)

    return { published: path }
  })

  return { preview, state, reader, published }
}

function badge() {
  const root = document.querySelector('forgepress-preview')?.shadowRoot

  return root ? { label: root.querySelector('span:not(.dot)')?.textContent, button: root.querySelector('button') } : undefined
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', undefined)
  localStorage.clear()
  document.body.replaceChildren()
  builds = 0
  failure = undefined
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('enablePreview', () => {
  it('leaves visitors on the published content without loading anything', async () => {
    const { preview, reader, published } = await load()

    expect(preview.enablePreview()).toBe(false)
    expect(await reader('index.json')).toEqual({ published: 'index.json' })
    expect(published).toEqual(['index.json'])
    expect(builds).toBe(0)
    expect(badge()).toBeUndefined()
  })

  it('answers queries from the preview for a signed-in editor and says so', async () => {
    const { preview, state, reader, published } = await load()

    state.openPreview(settings)

    expect(preview.enablePreview()).toBe(true)
    expect(badge()?.label).toBe('Loading preview…')
    expect(await reader('index.json')).toEqual({ version: 1, commit: null, build: 1 })
    expect(await reader('author/index.12345678.json')).toBeUndefined()
    expect(published).toEqual([])

    await settle()

    expect(badge()?.label).toBe('Preview')
    expect(builds).toBe(1)
  })

  it('builds again after the editor saved something, before the site reloads its data', async () => {
    const { preview, state, reader } = await load()
    const seen: unknown[] = []

    state.openPreview(settings)
    state.onPreviewChange(() => void reader('index.json').then(index => seen.push(index)))
    preview.enablePreview()

    await reader('index.json')

    state.announceChanges()
    await settle()

    expect(seen).toEqual([{ version: 1, commit: null, build: 2 }])
    expect(builds).toBe(2)
  })

  it('falls back to the published content when the preview can\'t be built', async () => {
    const { preview, state, reader, published } = await load()

    failure = new Error('[forgepress] Forgejo 401: token is expired')
    state.openPreview(settings)
    preview.enablePreview()

    expect(await reader('index.json')).toEqual({ published: 'index.json' })
    expect(published).toEqual(['index.json'])

    await settle()

    expect(badge()?.label).toBe('Preview unavailable')
  })

  it('turns off from the badge and reads the published content again', async () => {
    const { preview, state, reader } = await load()
    const changed = vi.fn()

    state.openPreview(settings)
    preview.enablePreview()
    preview.onPreviewChange(changed)

    await reader('index.json')
    await settle()

    badge()?.button?.click()

    expect(preview.previewing()).toBe(false)
    expect(changed).toHaveBeenCalledOnce()
    expect(badge()).toBeUndefined()
    expect(await reader('index.json')).toEqual({ published: 'index.json' })

    state.setPreviewEnabled(true)
    await settle()

    expect(badge()?.label).toBe('Preview')
    expect(await reader('index.json')).toEqual({ version: 1, commit: null, build: 2 })
  })
})
