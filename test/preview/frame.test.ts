// @vitest-environment happy-dom
import type { FrameDraft } from '../../src/preview/frame'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { draftMessage, FRAME_SOURCE, frameMessage, readyMessage } from '../../src/preview/frame'

const entry = { id: 'page_1', status: 'published' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', title: 'Home' }

const original = Object.getOwnPropertyDescriptor(window, 'parent')

function framed(): { posted: [unknown, string][], parent: object } {
  const posted: [unknown, string][] = []
  const parent = { postMessage: (data: unknown, origin: string) => void posted.push([data, origin]) }

  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent })

  return { posted, parent }
}

async function follow(): Promise<FrameDraft[]> {
  vi.resetModules()

  const { followEditor } = await import('../../src/preview/frame')
  const applied: FrameDraft[] = []

  followEditor(draft => void applied.push(draft))

  return applied
}

function send(data: unknown, source: unknown, origin = window.location.origin): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }))
}

afterEach(() => {
  if (original)
    Object.defineProperty(window, 'parent', original)
})

describe('frame messages', () => {
  it('reads the messages of the editor and nothing else', () => {
    const draft = draftMessage({ entries: [{ collection: 'page', entry }], server: '' })

    expect(frameMessage(readyMessage())).toEqual({ source: FRAME_SOURCE, type: 'ready' })
    expect(frameMessage(draft)).toEqual(draft)
    expect(frameMessage({ ...draft, server: 4 })).toEqual(draftMessage({ entries: [{ collection: 'page', entry }] }))
    expect(frameMessage({ ...draft, source: 'someone' })).toBeUndefined()
    expect(frameMessage({ ...draft, entries: [{ collection: 'page', entry: { title: 'No id' } }] })).toBeUndefined()
    expect(frameMessage({ source: FRAME_SOURCE, type: 'draft', entries: 'all' })).toBeUndefined()
    expect(frameMessage('ready')).toBeUndefined()
  })
})

describe('followEditor', () => {
  it('stays quiet on a page that is not framed', async () => {
    const applied = await follow()

    send(draftMessage({ entries: [{ collection: 'page', entry }] }), window)

    expect(applied).toEqual([])
  })

  it('tells the editor it is ready, on its own origin only', async () => {
    const { posted } = framed()

    await follow()

    expect(posted).toEqual([[readyMessage(), window.location.origin]])
  })

  it('takes drafts from the framing editor of the same origin', async () => {
    const { parent } = framed()
    const applied = await follow()

    send(draftMessage({ entries: [{ collection: 'page', entry }], server: 'http://localhost:4390' }), parent)

    expect(applied).toEqual([{ entries: [{ collection: 'page', entry }], server: 'http://localhost:4390' }])
  })

  it('ignores drafts from other origins, other windows and other senders', async () => {
    const { parent } = framed()
    const applied = await follow()

    send(draftMessage({ entries: [{ collection: 'page', entry }] }), parent, 'https://elsewhere.example')
    send(draftMessage({ entries: [{ collection: 'page', entry }] }), window)
    send({ source: 'someone', type: 'draft', entries: [] }, parent)

    expect(applied).toEqual([])
  })
})
