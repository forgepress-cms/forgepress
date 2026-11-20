import type { Entry } from '../entries'
import type { Schema } from '../schema'
import { describe, expect, it } from 'vitest'
import { singleIds } from './single'

function row(id: string, createdAt = '2024-01-01T00:00:00Z'): Entry {
  return { id, status: 'published', createdAt, updatedAt: createdAt }
}

function schema(collections: Record<string, boolean>): Schema {
  return { collections: Object.fromEntries(Object.entries(collections).map(([name, single]) => [name, { single, fields: {} }])) }
}

const createId = (collection: string): string => `${collection}_new`

describe('singleIds', () => {
  it('names the oldest entry after a collection that turns single', () => {
    const ids = singleIds([row('menu_2', '2024-02-01T00:00:00Z'), row('menu_1')], 'menu', 'menu', { before: schema({ menu: false }), after: schema({ menu: true }) }, createId)

    expect([...ids]).toEqual([['menu_1', 'menu']])
  })

  it('keeps the entry already named after the collection, and moves it along with a rename', () => {
    const rows = [row('menu_1'), row('menu', '2024-02-01T00:00:00Z')]

    expect([...singleIds(rows, 'menu', 'menu', { before: schema({ menu: true }), after: schema({ menu: true }) }, createId)]).toEqual([])
    expect([...singleIds(rows, 'menu', 'nav', { before: schema({ menu: true }), after: schema({ nav: true }) }, createId)]).toEqual([['menu', 'nav']])
  })

  it('gives the entry a new id when the collection stops being single', () => {
    expect([...singleIds([row('menu')], 'menu', 'menu', { before: schema({ menu: true }), after: schema({ menu: false }) }, createId)]).toEqual([['menu', 'menu_new']])
  })

  it('leaves the ids of other collections alone', () => {
    expect([...singleIds([row('post_1')], 'post', 'article', { before: schema({ post: false }), after: schema({ article: false }) }, createId)]).toEqual([])
  })
})
