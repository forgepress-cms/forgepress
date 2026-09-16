// @vitest-environment happy-dom
import type { VNode } from 'vue'
import type { Entries } from '../../../editor/composables/useEntries'
import type { FormField } from '../../../editor/utils/schema'
import type { Field } from '../../../src/schema/fields'
import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { clampMarkdown, fieldCell, thumbnails } from '../../../editor/utils/cells'

function render(node: () => VNode): HTMLElement {
  const host = document.createElement('div')

  createApp({ render: node }).mount(host)

  return host
}

describe('clampMarkdown', () => {
  it('renders emphasis as real elements', () => {
    expect(render(() => clampMarkdown('A **bold** claim')).innerHTML).toContain('<strong>bold</strong>')
  })

  it('keeps the plain text as the hover title', () => {
    const cell = render(() => clampMarkdown('## Heading\n\n**Body**')).firstElementChild!

    expect(cell.getAttribute('title')).toBe('Heading Body')
  })

  it('does not let content become markup', () => {
    const host = render(() => clampMarkdown('<img src=x onerror=alert(1)> stays text'))

    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('<img src=x onerror=alert(1)> stays text')
  })
})

describe('thumbnails', () => {
  it('renders an image for each asset', () => {
    const host = render(() => thumbnails([{ url: '/uploads/a.png' }, { url: '/uploads/b.png' }], 'image'))

    expect(host.querySelectorAll('img')).toHaveLength(2)
    expect(host.querySelectorAll('img')[1]!.getAttribute('src')).toBe('/uploads/b.png')
  })

  it('renders a video element for videos', () => {
    expect(render(() => thumbnails([{ url: '/uploads/clip.mp4' }], 'video')).querySelector('video')).not.toBeNull()
  })

  it('counts the assets it does not show', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(name => ({ url: `/uploads/${name}.png` }))
    const host = render(() => thumbnails(items, 'image'))

    expect(host.querySelectorAll('img')).toHaveLength(3)
    expect(host.textContent).toContain('+2')
  })

  it('shows a dash when there is nothing', () => {
    expect(render(() => thumbnails([], 'image')).textContent).toBe('—')
  })
})

const NAMES: Record<string, string> = {
  author_a1: 'Jane Doe',
  author_b2: 'John Roe',
  hero_c3: 'Welcome to our website',
  textBlock_d4: 'A short body',
}

const entries = {
  options: () => [],
  label: (_collection: string, id: unknown) => NAMES[String(id)] ?? String(id),
  collectionLabel: (collection: string) => collection,
  row: () => undefined,
  usedBy: () => [],
} satisfies Entries

function field(config: Field): FormField {
  return {
    key: 'value',
    label: 'Value',
    description: '',
    type: config.type,
    typeLabel: config.type,
    icon: '',
    config,
    translated: false,
    optional: false,
  }
}

describe('fieldCell', () => {
  it('names the entry a relation points at', () => {
    const cell = fieldCell(field({ type: 'relation', collection: 'author' }), 'author_a1', entries)

    expect(render(() => cell).textContent).toBe('Jane Doe')
  })

  it('names every entry of a multiple relation', () => {
    const config: Field = { type: 'relation', collection: 'author', multiple: true }
    const cell = fieldCell(field(config), ['author_a1', 'author_b2'], entries)

    expect(render(() => cell).textContent).toBe('Jane Doe, John Roe')
  })

  it('falls back to the id when the entry is gone', () => {
    const cell = fieldCell(field({ type: 'relation', collection: 'author' }), 'author_missing', entries)

    expect(render(() => cell).textContent).toBe('author_missing')
  })

  it('names the entries behind dynamic blocks', () => {
    const config: Field = { type: 'dynamic', collections: ['hero', 'textBlock'] }
    const value = [{ collection: 'hero', id: 'hero_c3' }, { collection: 'textBlock', id: 'textBlock_d4' }]

    expect(render(() => fieldCell(field(config), value, entries)).textContent).toBe('Welcome to our website, A short body')
  })

  it('renders richtext instead of printing markdown', () => {
    const cell = fieldCell(field({ type: 'richtext' }), '## Title\n\nWith **weight**', entries)

    expect(render(() => cell).innerHTML).toContain('<strong>weight</strong>')
  })

  it('shows media as thumbnails', () => {
    const cell = fieldCell(field({ type: 'image' }), { url: '/uploads/a.png' }, entries)

    expect(render(() => cell).querySelector('img')?.getAttribute('src')).toBe('/uploads/a.png')
  })

  it('leaves plain fields as text', () => {
    expect(render(() => fieldCell(field({ type: 'text' }), 'Jane', entries)).textContent).toBe('Jane')
  })
})
