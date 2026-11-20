// @vitest-environment happy-dom
import type { PreviewSettings } from './state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const settings: PreviewSettings = {
  provider: { type: 'forgejo', url: 'http://127.0.0.1:3310', repository: { owner: 'fred', name: 'site' } },
  contentPath: '.forgepress',
  mediaUrl: '/uploads',
}

async function load() {
  vi.resetModules()

  return import('./state')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preview state', () => {
  it('previews once an editor signed in, unless it was turned off', async () => {
    const state = await load()
    const changes: boolean[] = []

    state.onPreviewChange(() => changes.push(state.previewing()))

    expect(state.previewing()).toBe(false)

    state.openPreview(settings)
    state.openPreview(settings)

    expect(state.previewing()).toBe(true)
    expect(state.previewSettings()).toEqual(settings)

    state.setPreviewEnabled(false)
    state.setPreviewEnabled(false)

    expect(state.previewing()).toBe(false)
    expect(state.previewEnabled()).toBe(false)

    state.closePreview()
    state.setPreviewEnabled(true)

    expect(state.previewing()).toBe(false)

    state.openPreview(settings)

    expect(changes).toEqual([true, false, false, false, true])
  })

  it('keeps the choice to turn it off across signing out and in', async () => {
    const state = await load()

    state.openPreview(settings)
    state.setPreviewEnabled(false)
    state.closePreview()
    state.openPreview(settings)

    expect(state.previewing()).toBe(false)
  })

  it('counts every change, including ones other tabs made', async () => {
    const state = await load()
    const heard = vi.fn()

    state.onPreviewChange(heard)

    const before = state.previewVersion()

    window.dispatchEvent(new StorageEvent('storage', { key: 'forgepress:preview:off' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'forgepress:color-mode' }))

    expect(heard).toHaveBeenCalledTimes(1)
    expect(state.previewVersion()).toBe(before + 1)
  })

  it('tells other tabs and this one when saved changes were written', async () => {
    const posted: unknown[] = []

    vi.stubGlobal('BroadcastChannel', class {
      addEventListener(): void {}
      postMessage(message: unknown): void {
        posted.push(message)
      }
    })

    const state = await load()
    const heard = vi.fn()
    const written: string[] = []

    state.onPreviewChange(heard)

    const store = state.announcing<string>({
      read: async () => 'value',
      write: async (value) => {
        written.push(value)
      },
      clear: async () => {
        written.push('cleared')
      },
    })

    expect(await store.read()).toBe('value')

    await store.write('next')
    await store.clear()

    expect(written).toEqual(['next', 'cleared'])
    expect(posted).toEqual(['changes', 'changes'])
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it('ignores settings it can\'t read', async () => {
    const state = await load()

    localStorage.setItem('forgepress:preview', '{broken')

    expect(state.previewSettings()).toBeUndefined()
  })
})

describe('framed preview state', () => {
  const draft = [{ collection: 'page', entry: { id: 'page_1', status: 'published' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', title: 'Draft' } }]

  it('shows the signed-in content in the editor\'s frame, even with the site preview turned off', async () => {
    const state = await load()

    state.openPreview(settings)
    state.setPreviewEnabled(false)
    state.setFramedDraft({ entries: draft })

    expect(state.previewing()).toBe(true)
    expect(state.framedPreview()).toBe(true)
    expect(state.previewDraft()).toEqual(draft)
    expect(state.previewSource()).toEqual(settings)
  })

  it('needs a signed-in editor for the repository, but not for a dev server', async () => {
    const state = await load()

    state.setFramedDraft({ entries: [] })

    expect(state.previewing()).toBe(false)

    state.setFramedDraft({ entries: [], server: 'http://localhost:4390' })

    expect(state.previewing()).toBe(true)
    expect(state.previewSource()).toEqual({ server: 'http://localhost:4390' })
  })

  it('counts drafts as changes, but only a new source as new content', async () => {
    const state = await load()
    const seen: number[] = []

    state.onPreviewChange(() => seen.push(state.contentVersion()))

    state.setFramedDraft({ entries: [], server: '' })
    state.setFramedDraft({ entries: draft, server: '' })
    state.setFramedDraft({ entries: [], server: '' })
    state.openPreview(settings)

    expect(seen).toEqual([1, 1, 1, 2])
    expect(state.previewVersion()).toBe(4)
  })
})
