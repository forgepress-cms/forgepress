import type { ForgePressSchema } from '../../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { componentForms, seedField, seedOption, toFields, toKey } from '../../../editor/utils/schema'

describe('toKey', () => {
  it('camel cases names', () => {
    expect(toKey('Blog post')).toBe('blogPost')
    expect(toKey('  cover image ')).toBe('coverImage')
    expect(toKey('2 fast')).toBe('fast')
  })
})

describe('seedOption', () => {
  it('starts every kind of option empty', () => {
    expect(seedOption({ label: 'Multiple', type: 'boolean' })).toBe(false)
    expect(seedOption({ label: 'Collections', type: 'collections' })).toEqual([])
    expect(seedOption({ label: 'Step', type: 'number' })).toBeNull()
    expect(seedOption({ label: 'Components', type: 'components' })).toEqual([])
    expect(seedOption({ label: 'Label', type: 'text' })).toBe('')
  })
})

describe('componentForms', () => {
  const schema = {
    components: {
      grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
      card: { fields: { title: { type: 'text' } } },
    },
    collections: {
      page: { fields: { content: { type: 'component', components: ['grid', 'card'], multiple: true } } },
    },
  } as const satisfies ForgePressSchema

  it('builds one form per component, whatever holds it', () => {
    const forms = componentForms(schema.components)

    expect(Object.keys(forms)).toEqual(['grid', 'card'])
    expect(forms.grid!.fields[0]!.components).toEqual([forms.card])
  })

  it('shares that form instead of expanding a component once per path', () => {
    const [content] = toFields(schema.collections.page, [], schema.components)
    const [grid, card] = content!.components!

    expect(grid!.fields[0]!.components![0]).toBe(card)
  })

  it('holds a component that includes itself, since the schema is still being edited', () => {
    const looping = { row: { fields: { rows: { type: 'component', components: ['row'] } } } } as const satisfies ForgePressSchema['components']
    const forms = componentForms(looping)

    expect(forms.row!.fields[0]!.components![0]).toBe(forms.row)
  })
})

describe('seedField', () => {
  it('fills only the required options, with values the schema accepts', () => {
    expect(seedField('collection', ['author', 'post'])).toEqual({ type: 'collection', collections: ['author'] })
    expect(seedField('collection', [])).toEqual({ type: 'collection', collections: [] })
    expect(seedField('number', [])).toEqual({ type: 'number' })
    expect(seedField('component', ['author'], ['card', 'hero'])).toEqual({ type: 'component', components: ['card'] })
    expect(seedField('list', [])).toEqual({ type: 'list', values: [] })
  })
})
