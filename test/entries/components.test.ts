import type { Entry } from '../../src/entries/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { entryReferences } from '../../src/entries/references'
import { validateEntry } from '../../src/entries/validate'
import { toOutputEntry } from '../../src/output/entry'

const schema = {
  locales: ['en', 'de'],
  components: {
    card: {
      fields: {
        title: { type: 'text' },
        author: { type: 'collection', collections: ['author'], optional: true },
        wide: { type: 'boolean' },
      },
    },
    grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
    quote: { fields: { saying: { type: 'text' } } },
    note: { fields: { text: { type: 'text', translate: true }, link: { type: 'collection', collections: ['author'], translate: true, optional: true } } },
  },
  collections: {
    page: {
      fields: {
        cards: { type: 'component', components: ['card'], multiple: true, translate: true, optional: true },
        grid: { type: 'component', components: ['grid'], optional: true },
        mixed: { type: 'component', components: ['card', 'quote'], multiple: true, optional: true },
        notes: { type: 'component', components: ['note'], multiple: true, optional: true },
      },
    },
    author: { fields: {} },
  },
} as const satisfies ForgePressSchema

function page(fields: Record<string, unknown>): Entry {
  return { id: 'page_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', ...fields }
}

describe('component values', () => {
  it('accepts items that fit their component, per locale', () => {
    expect(validateEntry(schema, 'page', page({
      cards: { en: [{ title: 'One', wide: false }], de: [] },
      grid: { cards: [{ title: 'Nested', author: 'author_1', wide: true }] },
    }))).toEqual([])
  })

  it('checks items like small entries, with paths into the list', () => {
    expect(validateEntry(schema, 'page', page({
      cards: { en: [{ title: 1, wide: false }, { wide: true, colour: 'red' }, 'card'] },
      grid: [],
    }))).toEqual([
      { path: ['cards', 'en', 0, 'title'], message: 'Field "title" has to be a string' },
      { path: ['cards', 'en', 1, 'colour'], message: '"colour" is not a field of component "card"' },
      { path: ['cards', 'en', 1], message: 'Field "title" is required' },
      { path: ['cards', 'en', 2], message: 'Field "cards" (en) has to hold "card" items as objects' },
      { path: ['grid'], message: 'Field "grid" has to hold "grid" items as objects' },
    ])

    expect(validateEntry(schema, 'page', page({ cards: { en: { title: 'One', wide: false } } }))).toEqual([
      { path: ['cards', 'en'], message: 'Field "cards" (en) has to be a list of "card" items' },
    ])
  })

  it('reads which component a mixed item holds, and checks it against that one', () => {
    expect(validateEntry(schema, 'page', page({
      mixed: [{ component: 'card', title: 'One', wide: false }, { component: 'quote', saying: 'Hi' }],
    }))).toEqual([])

    expect(validateEntry(schema, 'page', page({
      mixed: [{ title: 'One', wide: false }, { component: 'grid', cards: [] }, { component: 'quote', title: 'One' }],
    }))).toEqual([
      { path: ['mixed', 0], message: 'An item in field "mixed" needs a "component"' },
      { path: ['mixed', 1, 'component'], message: 'Field "mixed" can\'t hold "grid" items; allowed are card, quote' },
      { path: ['mixed', 2, 'title'], message: '"title" is not a field of component "quote"' },
      { path: ['mixed', 2], message: 'Field "saying" is required' },
    ])
  })

  it('finds references inside mixed items and keeps their component in the output', () => {
    const entry = page({ mixed: [{ component: 'card', title: 'One', author: 'author_1', wide: false }] })

    expect(entryReferences(schema, 'page', entry)).toEqual([
      { path: ['mixed', 0, 'author'], collection: 'author', id: 'author_1' },
    ])

    expect(toOutputEntry(schema, 'page', entry).mixed).toEqual([
      { component: 'card', title: 'One', author: { collection: 'author', id: 'author_1' }, wide: false },
    ])
  })

  it('translates fields inside an item, one value per locale', () => {
    expect(validateEntry(schema, 'page', page({
      notes: [{ text: { en: 'Hello', de: 'Hallo' }, link: { en: 'author_1' } }],
    }))).toEqual([])

    expect(validateEntry(schema, 'page', page({
      notes: [{ text: { en: 'Hello' } }, { text: 'Hello' }],
    }))).toEqual([
      { path: ['notes', 0, 'text'], message: 'Field "text" is missing its de translation' },
      { path: ['notes', 1, 'text'], message: 'Field "text" is translated and has to hold one value per locale, such as { en: … }' },
    ])
  })

  it('resolves translated item fields for the locale of the output, and finds their references', () => {
    const entry = page({ notes: [{ text: { en: 'Hello', de: 'Hallo' }, link: { de: 'author_1' } }] })

    expect(toOutputEntry(schema, 'page', entry, 'de').notes).toEqual([{ text: 'Hallo', link: { collection: 'author', id: 'author_1' } }])
    expect(toOutputEntry(schema, 'page', entry, 'en').notes).toEqual([{ text: 'Hello' }])

    expect(entryReferences(schema, 'page', entry)).toEqual([
      { path: ['notes', 0, 'link', 'de'], collection: 'author', id: 'author_1' },
    ])
  })

  it('finds references inside items', () => {
    expect(entryReferences(schema, 'page', page({
      cards: { en: [{ title: 'One', author: 'author_1', wide: false }] },
      grid: { cards: [{ title: 'Two', author: 'author_2', wide: false }] },
    }))).toEqual([
      { path: ['cards', 'en', 0, 'author'], collection: 'author', id: 'author_1' },
      { path: ['grid', 'cards', 0, 'author'], collection: 'author', id: 'author_2' },
    ])
  })

  it('outputs relations inside items as references, keeping the item order', () => {
    const output = toOutputEntry(schema, 'page', page({
      cards: { de: [{ title: 'Eins', author: 'author_1', wide: false }, { title: 'Zwei', wide: true }] },
      grid: { cards: [{ title: 'Two', author: 'author_2', wide: false }] },
    }), 'de')

    expect(output.cards).toEqual([{ title: 'Eins', author: { collection: 'author', id: 'author_1' }, wide: false }, { title: 'Zwei', wide: true }])
    expect(output.grid).toEqual({ cards: [{ title: 'Two', author: { collection: 'author', id: 'author_2' }, wide: false }] })
  })
})
