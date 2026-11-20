// @vitest-environment happy-dom
import type { PreviewContext, PreviewPane, PreviewServer } from '../../../editor/plugins/preview'
import type { PreviewLink } from '../../../editor/types'
import type { Schema } from '../../../src/schema/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { clampRatio, createPreviewPane, DEFAULT_RATIO, previewLink, previewPage } from '../../../editor/plugins/preview'
import { draftMessage, readyMessage } from '../../../src/preview/frame'
import { settle } from '../../settle'

const schema: Schema = {
  collections: {
    page: { fields: { title: { type: 'text', translate: true }, slug: { type: 'text', translate: true } } },
  },
  locales: ['en', 'de'],
  defaultLocale: 'de',
}

const plain: Schema = { collections: { note: { fields: { text: { type: 'text' } } } } }

const row = { id: 'page_1', status: 'published' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', title: { en: 'Home', de: 'Start' }, slug: { en: '/home', de: '/start' } }

const page: PreviewContext = { schema, collection: 'page', id: 'page_1', entry: row }

const panes: PreviewPane[] = []

let wide = true

function pane(link: PreviewLink | undefined, server: PreviewServer = { local: false, devServer: '' }): PreviewPane {
  const created = createPreviewPane(link, async () => server)

  panes.push(created)

  return created
}

function frame() {
  const posted: [unknown, string][] = []
  const replaced: string[] = []
  const listeners = new Map<string, () => void>()
  const view = {
    postMessage: (data: unknown, origin: string) => void posted.push([data, origin]),
    location: { replace: (url: string) => void replaced.push(url), reload: () => {}, pathname: '/start', search: '?a=1', hash: '' },
  }
  const element = {
    contentWindow: view,
    src: '',
    addEventListener: (type: string, listener: () => void) => void listeners.set(type, listener),
    removeEventListener: (type: string) => void listeners.delete(type),
  }

  return { element: element as unknown as HTMLIFrameElement, view, posted, replaced, load: () => listeners.get('load')?.() }
}

function say(data: unknown, source: unknown, origin = window.location.origin): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }))
}

beforeEach(() => {
  localStorage.clear()
  wide = true
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: wide,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
})

afterEach(() => {
  for (const created of panes.splice(0))
    created.dispose()

  vi.restoreAllMocks()
})

describe('previewLink', () => {
  it('takes a fixed address, or what the function returns for the page', () => {
    expect(previewLink('/', {})).toBe('/')
    expect(previewLink(({ collection }) => collection && `/${collection}`, { collection: 'page' })).toBe('/page')
    expect(previewLink(() => '', {})).toBeUndefined()
    expect(previewLink(undefined, {})).toBeUndefined()
  })

  it('ignores a link function that fails', () => {
    expect(previewLink(() => {
      throw new Error('no slug')
    }, {})).toBeUndefined()
  })
})

describe('previewPage', () => {
  it('hands the entry over the way the site queries it, in the chosen language', () => {
    expect(previewPage(page, 'en')).toEqual({
      collection: 'page',
      id: 'page_1',
      entry: { id: 'page_1', createdAt: row.createdAt, updatedAt: row.updatedAt, title: 'Home', slug: '/home' },
      locale: 'en',
    })
  })

  it('names only the collection, or nothing, on other pages', () => {
    expect(previewPage({ schema, collection: 'page' }, 'de')).toEqual({ collection: 'page', locale: 'de' })
    expect(previewPage(undefined, undefined)).toEqual({})
  })
})

describe('clampRatio', () => {
  it('keeps both sides usable', () => {
    expect(clampRatio(0.05)).toBe(0.2)
    expect(clampRatio(0.95)).toBe(0.8)
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_RATIO)
  })
})

describe('createPreviewPane', () => {
  it('stays closed without a link to the site', () => {
    const created = pane(undefined)

    created.toggle()

    expect(created.available).toBe(false)
    expect(created.open.value).toBe(false)
  })

  it('docks beside the editor on wide screens and remembers it', async () => {
    const created = pane('/')

    created.toggle()
    await nextTick()

    expect(created.open.value).toBe(true)
    expect(created.overlay.value).toBe(false)
    expect(localStorage.getItem('forgepress:editor:preview')).toBe('1')

    created.close()
    await nextTick()

    expect(localStorage.getItem('forgepress:editor:preview')).toBeNull()
  })

  it('slides over the editor on small screens without remembering it', async () => {
    wide = false

    const created = pane('/')

    created.toggle()
    await nextTick()

    expect(created.open.value).toBe(true)
    expect(created.docked.value).toBe(false)
    expect(localStorage.getItem('forgepress:editor:preview')).toBeNull()
  })

  it('remembers the width once it was set', () => {
    const created = pane('/')

    created.resizing.value = true
    created.resize(0.7)

    expect(localStorage.getItem('forgepress:editor:preview-ratio')).toBeNull()

    created.resize(0.9)

    expect(created.ratio.value).toBe(0.8)

    created.resizing.value = false
    created.resize(0.3)

    expect(localStorage.getItem('forgepress:editor:preview-ratio')).toBe('0.3')
    expect(pane('/').ratio.value).toBe(0.3)
  })

  it('follows the page of the editor and keeps the last address the link knew', async () => {
    const created = pane(({ entry }) => entry?.slug as string | undefined)

    expect(created.url.value).toBe('/')

    const hide = created.show(page)
    await nextTick()

    expect(created.locale.value).toBe('de')
    expect(created.url.value).toBe('/start')

    created.locale.value = 'en'
    await nextTick()

    expect(created.url.value).toBe('/home')

    hide()
    await nextTick()

    expect(created.url.value).toBe('/home')
  })

  it('forgets the language for a schema without languages', async () => {
    const created = pane('/')

    created.show(page)
    await nextTick()
    created.show({ schema: plain, collection: 'note' })
    await nextTick()

    expect(created.locale.value).toBeUndefined()
    expect(created.locales.value).toEqual([])
  })

  it('sends the draft to the frame once it says it is ready, and to nobody else', async () => {
    const created = pane('/')
    const { element, view, posted } = frame()
    const entries = [{ collection: 'page', entry: row }]

    created.attach(element)
    created.draft(entries)
    await settle()

    say(readyMessage(), view)
    say(readyMessage(), view, 'https://elsewhere.example')
    say(readyMessage(), window)
    await settle()

    expect(posted).toEqual([
      [draftMessage({ entries }), window.location.origin],
      [draftMessage({ entries }), window.location.origin],
    ])
  })

  it('tells the frame where the dev server is when the editor works on local files', async () => {
    const created = pane('/', { local: true, devServer: 'http://localhost:4390' })
    const { element, view, posted } = frame()

    created.attach(element)
    say(readyMessage(), view)
    await settle()

    expect(posted).toEqual([[draftMessage({ entries: [], server: 'http://localhost:4390' }), window.location.origin]])
  })

  it('loads the address once, then moves the frame without adding to the history', async () => {
    const created = pane(({ entry }) => entry?.slug as string | undefined)
    const { element, replaced, load } = frame()

    created.attach(element)

    expect(element.src).toBe(new URL('/', window.location.href).href)
    expect(created.loading.value).toBe(true)

    created.show(page)
    await nextTick()

    expect(replaced).toEqual([new URL('/start', window.location.href).href])

    load()

    expect(created.loading.value).toBe(false)
    expect(created.address.value).toBe('/start?a=1')
  })
})
