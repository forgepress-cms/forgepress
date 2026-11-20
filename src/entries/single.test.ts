import type { Schema } from '../schema'
import { describe, expect, it } from 'vitest'
import { validateSingles } from './single'

const schema: Schema = {
  collections: {
    settings: { single: true, fields: { title: { type: 'text' } } },
    post: { fields: { title: { type: 'text' } } },
  },
}

function row(id: string, createdAt: string) {
  return { id, status: 'published' as const, createdAt, updatedAt: createdAt }
}

describe('validateSingles', () => {
  it('keeps the first entry of a single collection and reports the others', () => {
    expect(validateSingles(schema, {
      settings: { b: row('b', '2024-02-01T00:00:00Z'), a: row('a', '2024-01-01T00:00:00Z'), c: row('c', '2024-03-01T00:00:00Z') },
      post: { x: row('x', '2024-01-01T00:00:00Z'), y: row('y', '2024-01-02T00:00:00Z') },
    })).toEqual([
      { collection: 'settings', id: 'b', path: ['id'], message: 'Collection "settings" is single and already has settings/a; remove this entry or turn off "single"' },
      { collection: 'settings', id: 'c', path: ['id'], message: 'Collection "settings" is single and already has settings/a; remove this entry or turn off "single"' },
    ])
  })

  it('accepts one entry or none', () => {
    expect(validateSingles(schema, { settings: { a: row('a', '2024-01-01T00:00:00Z') } })).toEqual([])
    expect(validateSingles(schema, {})).toEqual([])
  })
})
