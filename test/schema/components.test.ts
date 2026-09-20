import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { serializeSchema } from '../../src/files/serialize'
import { validateSchema } from '../../src/schema/validate'

function schema(extra: Record<string, unknown>): unknown {
  return {
    locales: ['en', 'de'],
    components: { card: { fields: { title: { type: 'text' } } } },
    collections: { page: { fields: { cards: { type: 'component', components: ['card'], multiple: true, translate: true } } } },
    ...extra,
  }
}

describe('components in the schema', () => {
  it('accepts collections holding components', () => {
    expect(validateSchema(schema({}))).toEqual([])
  })

  it('wants a component field to name a component', () => {
    expect(validateSchema(schema({ collections: { page: { fields: { cards: { type: 'component', components: ['tile'] }, hero: { type: 'component' } } } } }))).toEqual([
      { path: ['collections', 'page', 'fields', 'cards', 'components', 0], message: 'Field "page.cards" references unknown component "tile"' },
      { path: ['collections', 'page', 'fields', 'hero'], message: 'Field "page.hero" needs "components"' },
    ])
  })

  it('keeps indexes out of components', () => {
    expect(validateSchema(schema({ components: { card: { fields: { title: { type: 'text', index: true } } } } }))).toEqual([
      { path: ['components', 'card', 'fields', 'title', 'index'], message: 'Field "card.title" is inside a component and can\'t be indexed' },
    ])
  })

  it('translates a field inside a component, but not both it and the field holding it', () => {
    const translating = { card: { fields: { title: { type: 'text', translate: true } } } }

    expect(validateSchema(schema({
      components: translating,
      collections: { page: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } } },
    }))).toEqual([])

    expect(validateSchema(schema({ components: translating }))).toEqual([
      { path: ['collections', 'page', 'fields', 'cards', 'translate'], message: 'Field "page.cards" is translated, and so is component "card"; translate one or the other' },
    ])
  })

  it('sees translations through nested components', () => {
    expect(validateSchema(schema({
      components: {
        card: { fields: { title: { type: 'text', translate: true } } },
        grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
      },
      collections: { page: { fields: { grid: { type: 'component', components: ['grid'], translate: true } } } },
    }))).toEqual([
      { path: ['collections', 'page', 'fields', 'grid', 'translate'], message: 'Field "page.grid" is translated, and so is component "grid"; translate one or the other' },
    ])
  })

  it('checks component names and definitions like collections', () => {
    expect(validateSchema(schema({ components: { 'Card': { fields: {} }, 'hero': 'big', 'x-y': { label: 3 } } }))).toEqual([
      { path: ['components', 'Card'], message: 'Component "Card" has to start with a lowercase letter and contain only letters and digits' },
      { path: ['components', 'hero'], message: 'Component "hero" has to be an object' },
      { path: ['components', 'x-y'], message: 'Component "x-y" has to start with a lowercase letter and contain only letters and digits' },
      { path: ['components', 'x-y', 'label'], message: '"label" of component "x-y" has to be a string' },
      { path: ['components', 'x-y'], message: 'Component "x-y" needs "fields" as an object' },
      { path: ['collections', 'page', 'fields', 'cards', 'components', 0], message: 'Field "page.cards" references unknown component "card"' },
    ])
  })

  it('keeps "component" free inside a component, since items carry their name there', () => {
    expect(validateSchema(schema({
      components: { card: { fields: { component: { type: 'text' } } } },
      collections: { page: { fields: { cards: { type: 'component', components: ['card'] } } } },
    }))).toEqual([
      { path: ['components', 'card', 'fields', 'component'], message: 'Field "card.component" uses "component", which is reserved for the component an item holds' },
    ])
  })

  it('lets components hold other components, but not themselves', () => {
    const nested = { grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } }, card: { fields: { title: { type: 'text' } } } }

    expect(validateSchema(schema({ components: nested }))).toEqual([])

    const looped = { a: { fields: { b: { type: 'component', components: ['b'] } } }, b: { fields: { a: { type: 'component', components: ['a'], optional: true } } }, card: { fields: {} } }

    expect(validateSchema(schema({ components: looped }))).toEqual([
      { path: ['components', 'a'], message: 'Component "a" includes itself through a → b → a' },
    ])
  })

  it('writes components ahead of the collections that use them', () => {
    const text = serializeSchema({ locales: ['en'], collections: { page: { fields: {} } }, components: { card: { fields: {} } } } as ForgePressSchema)

    expect(text.indexOf('components:')).toBeLessThan(text.indexOf('collections:'))
    expect(text.indexOf('locales:')).toBeLessThan(text.indexOf('components:'))
    expect(serializeSchema({ collections: {}, components: {} })).not.toContain('components')
  })
})
