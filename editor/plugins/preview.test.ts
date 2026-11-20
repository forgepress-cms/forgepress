import type { Schema } from '../../src/schema/types'
// @vitest-environment happy-dom
import type { PreviewContext, PreviewPane, PreviewServer } from './preview'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { draftMessage, readyMessage } from '../../src/preview/frame'
import { settle } from '../../test/settle'
import { clampRatio, createPreviewPane, DEFAULT_RATIO, previewTarget } from './preview'

const ADDRESS = '{slug}?locale={locale}'

const schema: Schema = {
  collections: {
    page: { preview: ADDRESS, fields: { title: { type: 'text', label: 'Title', translate: true }, slug: { type: 'text', label: 'Slug', translate: true } } },
    post: { preview: '/posts/{id}', fields: { title: { type: 'text', translate: true } } },
    article: { preview: { en: '/en{slug}', de: '{slug}' }, fields: { slug: { type: 'text', translate: true } } },
    news: { preview: { en: '/news{slug}' }, fields: { slug: { type: 'text', translate: true } } },
    note: { fields: { text: { type: 'text' } } },
  },
  locales: ['en', 'de'],
  defaultLocale: 'de',
}

const plain: Schema = { collections: { note: { preview: '/notes/{id}', fields: { text: { type: 'text' } } } } }

const meta = { status: 'published' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
const row = { id: 'page_1', ...meta, title: { en: 'Home', de: 'Start' }, slug: { en: '/home', de: '/start' } }

const page: PreviewContext = { schema, collection: 'page', id: 'page_1', entry: row }
const post: PreviewContext = { schema, collection: 'post', id: 'post_1', entry: { id: 'post_1', ...meta, title: { en: 'News', de: 'Neues' } } }
const fresh: PreviewContext = { schema, collection: 'page' }

const panes: PreviewPane[] = []

let wide = true

function pane(server: PreviewServer = { local: false, devServer: '' }): PreviewPane {
  const created = createPreviewPane(async () => server)

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

describe('previewTarget', () => {
  it('fills the address of the collection from the saved entry, in the chosen language', () => {
    expect(previewTarget(page, ADDRESS, 'en')).toEqual({ url: '/home?locale=en', hint: '' })
    expect(previewTarget(page, ADDRESS, 'de')).toEqual({ url: '/start?locale=de', hint: '' })
  })

  it('says what the entry still needs for an address', () => {
    expect(previewTarget(fresh, ADDRESS, 'en')).toEqual({ hint: 'Save the entry to see its page.' })
    expect(previewTarget({ ...page, entry: { id: 'page_1', ...meta, title: { en: 'Home', de: 'Start' } } }, ADDRESS, 'en')).toEqual({ hint: 'Fill in Slug and save to see the page.' })
  })

  it('stays on the site', () => {
    expect(previewTarget({ ...page, entry: { ...row, slug: { en: '//elsewhere.example/home', de: '/start' } } }, ADDRESS, 'en')).toEqual({ hint: 'The address of this entry leads off the site.' })
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
  it('offers the preview only on collections with an address, and remembers it was open', async () => {
    const created = pane()

    created.toggle()
    await nextTick()

    expect(created.available.value).toBe(false)
    expect(created.open.value).toBe(false)

    created.show(page)
    await nextTick()

    expect(created.available.value).toBe(true)
    expect(created.open.value).toBe(true)

    created.show({ schema, collection: 'note' })
    await nextTick()

    expect(created.available.value).toBe(false)
    expect(created.open.value).toBe(false)

    created.show(post)
    await nextTick()

    expect(created.open.value).toBe(true)
  })

  it('docks beside the editor on wide screens and remembers it', async () => {
    const created = pane()

    created.show(page)
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

    const created = pane()

    created.show(page)
    created.toggle()
    await nextTick()

    expect(created.open.value).toBe(true)
    expect(created.docked.value).toBe(false)
    expect(localStorage.getItem('forgepress:editor:preview')).toBeNull()
  })

  it('closes the slide-over once the page has no preview, and keeps the docked pane for the next entry', async () => {
    wide = false

    const small = pane()
    const hide = small.show(page)

    small.toggle()
    await nextTick()
    hide()
    await nextTick()
    small.show(page)
    await nextTick()

    expect(small.open.value).toBe(false)

    wide = true

    const large = pane()
    const leave = large.show(page)

    large.toggle()
    await nextTick()
    leave()
    await nextTick()

    expect(large.open.value).toBe(false)

    large.show(page)
    await nextTick()

    expect(large.open.value).toBe(true)
  })

  it('remembers the width once it was set', () => {
    const created = pane()

    created.resizing.value = true
    created.resize(0.7)

    expect(localStorage.getItem('forgepress:editor:preview-ratio')).toBeNull()

    created.resize(0.9)

    expect(created.ratio.value).toBe(0.8)

    created.resizing.value = false
    created.resize(0.3)

    expect(localStorage.getItem('forgepress:editor:preview-ratio')).toBe('0.3')
    expect(pane().ratio.value).toBe(0.3)
  })

  it('follows the entry of the editor and its language, and has no address elsewhere', async () => {
    const created = pane()

    expect(created.url.value).toBeUndefined()

    const hide = created.show(page)
    await nextTick()

    expect(created.locale.value).toBe('de')
    expect(created.url.value).toBe('/start?locale=de')

    created.locale.value = 'en'
    await nextTick()

    expect(created.url.value).toBe('/home?locale=en')

    hide()
    await nextTick()

    expect(created.url.value).toBeUndefined()
  })

  it('tells why it has nothing to show', async () => {
    const created = pane()

    created.show(fresh)
    await nextTick()

    expect(created.url.value).toBeUndefined()
    expect(created.hint.value).toBe('Save the entry to see its page.')
  })

  it('takes the address of the chosen language, and offers only the languages that have one', async () => {
    const created = pane()
    const slug = { en: '/hello', de: '/hallo' }

    created.show({ schema, collection: 'article', id: 'article_1', entry: { id: 'article_1', ...meta, slug } })
    await nextTick()

    expect(created.locales.value).toEqual(['en', 'de'])
    expect(created.locale.value).toBe('de')
    expect(created.url.value).toBe('/hallo')

    created.locale.value = 'en'
    await nextTick()

    expect(created.url.value).toBe('/en/hello')

    created.locale.value = 'de'
    created.show({ schema, collection: 'news', id: 'news_1', entry: { id: 'news_1', ...meta, slug } })
    await nextTick()

    expect(created.locales.value).toEqual(['en'])
    expect(created.locale.value).toBe('en')
    expect(created.url.value).toBe('/news/hello')
  })

  it('switches languages only when the address names one', async () => {
    const created = pane()

    created.show(page)
    await nextTick()

    expect(created.locales.value).toEqual(['en', 'de'])

    created.show(post)
    await nextTick()

    expect(created.locales.value).toEqual([])
  })

  it('forgets the language for a schema without languages', async () => {
    const created = pane()

    created.show(page)
    await nextTick()
    created.show({ schema: plain, collection: 'note', id: 'note_1', entry: { id: 'note_1', ...meta, text: 'Hi' } })
    await nextTick()

    expect(created.locale.value).toBeUndefined()
    expect(created.url.value).toBe('/notes/note_1')
  })

  it('sends the draft to the frame once it says it is ready, and to nobody else', async () => {
    const created = pane()
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
    const created = pane({ local: true, devServer: 'http://localhost:4390' })
    const { element, view, posted } = frame()

    created.attach(element)
    say(readyMessage(), view)
    await settle()

    expect(posted).toEqual([[draftMessage({ entries: [], server: 'http://localhost:4390' }), window.location.origin]])
  })

  it('loads the address once, then moves the frame without adding to the history', async () => {
    const created = pane()
    const { element, replaced, load } = frame()

    created.show(page)
    await nextTick()
    created.attach(element)

    expect(element.src).toBe(new URL('/start?locale=de', window.location.href).href)
    expect(created.loading.value).toBe(true)

    created.locale.value = 'en'
    await nextTick()

    expect(replaced).toEqual([new URL('/home?locale=en', window.location.href).href])

    load()

    expect(created.loading.value).toBe(false)
    expect(created.address.value).toBe('/start?a=1')
  })

  it('stops loading once the entry has no address', async () => {
    const created = pane()
    const { element } = frame()

    created.show(page)
    await nextTick()
    created.attach(element)
    created.show(fresh)
    await nextTick()

    expect(created.loading.value).toBe(false)
    expect(created.address.value).toBe('')
  })
})
