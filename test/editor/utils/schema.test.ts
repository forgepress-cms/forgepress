import { describe, expect, it } from 'vitest'
import { seedField, seedOption, toKey } from '../../../src/editor/utils/schema'

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
    expect(seedOption({ label: 'Collection', type: 'collection' })).toBe('')
  })
})

describe('seedField', () => {
  it('fills only the required options, with values the schema accepts', () => {
    expect(seedField('relation', ['author', 'post'])).toEqual({ type: 'relation', collection: 'author' })
    expect(seedField('dynamic', ['author'])).toEqual({ type: 'dynamic', collections: [] })
    expect(seedField('number', [])).toEqual({ type: 'number' })
  })
})
