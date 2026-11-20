import type { Schema } from '../schema'
import { describe, expect, it } from 'vitest'
import { validateSingles } from './single'

const schema: Schema = {
  collections: {
    settings: { single: true, fields: { title: { type: 'text' } } },
    menu: { single: true, fields: {} },
    post: { fields: { title: { type: 'text' } } },
  },
}

function row(id: string) {
  return { id, status: 'published' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
}

describe('validateSingles', () => {
  it('accepts the entry named after its single collection, and any other name elsewhere', () => {
    expect(validateSingles(schema, { settings: { settings: row('settings') }, post: { post_1: row('post_1') } })).toEqual([])
    expect(validateSingles(schema, {})).toEqual([])
  })

  it('reports the other entries of a single collection', () => {
    expect(validateSingles(schema, { settings: { settings: row('settings'), settings_2: row('settings_2') }, menu: { menu_1: row('menu_1') } })).toEqual([
      { collection: 'settings', id: 'settings_2', path: ['id'], message: 'Collection "settings" is single and already has settings/settings; remove this entry or turn off "single"' },
      { collection: 'menu', id: 'menu_1', path: ['id'], message: 'Collection "menu" is single, so its entry needs the id "menu"; give it that id or turn off "single"' },
    ])
  })

  it('keeps the name of a collection for the entry of a single collection', () => {
    expect(validateSingles(schema, { post: { post: row('post') } })).toEqual([
      { collection: 'post', id: 'post', path: ['id'], message: 'Collection "post" isn\'t single, so its entries can\'t have the id "post"; give this entry another id or turn on "single"' },
    ])
  })

  it('leaves collections the schema does not have to the other checks', () => {
    expect(validateSingles(schema, { page: { page: row('page') } })).toEqual([])
  })
})
