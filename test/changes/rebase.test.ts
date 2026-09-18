import type { Entry } from '../../src/entries/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { adaptEntry } from '../../src/changes/rebase'

const schema: ForgePressSchema = {
  locales: ['en', 'de'],
  collections: {
    post: {
      fields: {
        title: { type: 'text', translate: true },
        rating: { type: 'number', optional: true },
        body: { type: 'richtext', optional: true },
      },
    },
  },
}

function entry(fields: Record<string, unknown>, updatedAt = '2026-01-01T00:00:00Z'): Entry {
  return { id: 'post_1', status: 'published', createdAt: '2026-01-01T00:00:00Z', updatedAt, ...fields }
}

describe('adapting pending edits', () => {
  it('keeps my edit of one field on top of a migration of another', () => {
    const base = entry({ heading: 'Hello', rating: '4' })
    const head = entry({ title: { en: 'Hello' }, rating: 4 }, '2026-02-01T00:00:00Z')
    const mine = entry({ heading: 'Hello', rating: '4', body: 'New text' }, '2026-01-15T00:00:00Z')

    expect(adaptEntry(mine, schema, 'post', base, head)).toEqual({
      entry: entry({ title: { en: 'Hello' }, rating: 4, body: 'New text' }, '2026-02-01T00:00:00Z'),
      dropped: [],
      conflicts: [],
    })
  })

  it('moves my edit of a renamed field along, converted to its new shape', () => {
    const base = entry({ heading: 'Hello' })
    const head = entry({ title: { en: 'Hello' } })
    const mine = entry({ heading: 'Hello there' })

    expect(adaptEntry(mine, schema, 'post', base, head)).toMatchObject({ entry: { title: { en: 'Hello there' } }, dropped: [], conflicts: [] })
  })

  it('reports a field both sides changed differently', () => {
    const base = entry({ title: { en: 'Hello' } })
    const head = entry({ title: { en: 'Hi' } })
    const mine = entry({ title: { en: 'Hey' } })

    expect(adaptEntry(mine, schema, 'post', base, head).conflicts).toEqual(['title'])
  })

  it('takes their status unless I changed it', () => {
    const base = entry({ title: { en: 'Hello' } })
    const head = { ...entry({ title: { en: 'Hello' } }), status: 'unpublished' as const }

    expect(adaptEntry(entry({ title: { en: 'Hey' } }), schema, 'post', base, head).entry.status).toBe('unpublished')
    expect(adaptEntry({ ...base, status: 'unpublished' }, schema, 'post', base, entry({ title: { en: 'Hello' } })).entry.status).toBe('unpublished')
  })

  it('leaves out my edits of fields that were removed', () => {
    const base = entry({ title: { en: 'Hello' }, subtitle: 'Old' })
    const head = entry({ title: { en: 'Hello' } })
    const mine = entry({ title: { en: 'Hello' }, subtitle: 'New' })

    expect(adaptEntry(mine, schema, 'post', base, head)).toMatchObject({ entry: entry({ title: { en: 'Hello' } }), dropped: ['subtitle'], conflicts: [] })
  })

  it('fits a new entry to the schema', () => {
    expect(adaptEntry(entry({ title: 'Hello', colour: 'red', rating: '5' }), schema, 'post')).toEqual({
      entry: entry({ title: { en: 'Hello' }, rating: 5 }),
      dropped: ['colour'],
      conflicts: [],
    })
  })
})
