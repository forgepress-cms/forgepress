import type { Entry } from '../../src/entries/types'
import type { Field } from '../../src/schema/fields'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { validateEntry } from '../../src/entries/validate'
import { planMigration } from '../../src/migrate/plan'
import { validateSchema } from '../../src/schema/validate'

const schema = {
  collections: {
    post: {
      fields: {
        stage: { type: 'list', values: ['draft', 'review', 'final'] },
        tags: { type: 'list', values: ['news', 'guide'], multiple: true, optional: true },
      },
    },
  },
} as const satisfies ForgePressSchema

function post(fields: Record<string, unknown>): Entry {
  return { id: 'post_1', status: 'published', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...fields }
}

describe('list fields', () => {
  it('want their values as strings without duplicates in the schema', () => {
    expect(validateSchema(schema)).toEqual([])
    expect(validateSchema({ collections: { post: { fields: { stage: { type: 'list', values: ['a', 1, 'a'] } } } } })).toEqual([
      { path: ['collections', 'post', 'fields', 'stage', 'values'], message: '"values" of field "post.stage" has to be a list of strings' },
      { path: ['collections', 'post', 'fields', 'stage', 'values', 2], message: 'Field "post.stage" lists the value "a" twice' },
    ])
    expect(validateSchema({ collections: { post: { fields: { stage: { type: 'list', values: ['a', 'b', 'a'] } } } } })).toEqual([
      { path: ['collections', 'post', 'fields', 'stage', 'values', 2], message: 'Field "post.stage" lists the value "a" twice' },
    ])
  })

  it('accept one value, or a list of values when multiple', () => {
    expect(validateEntry(schema, 'post', post({ stage: 'review', tags: ['guide', 'news'] }))).toEqual([])
    expect(validateEntry(schema, 'post', post({ stage: 'published', tags: 'news' }))).toEqual([
      { path: ['stage'], message: 'Field "stage" has to be one of "draft", "review", "final"' },
      { path: ['tags'], message: 'Field "tags" has to be a list of values' },
    ])
    expect(validateEntry(schema, 'post', post({ stage: 1, tags: ['news', 'blog'] }))).toEqual([
      { path: ['stage'], message: 'Field "stage" has to be a string' },
      { path: ['tags', 1], message: 'Field "tags" has to be one of "news", "guide"' },
    ])
  })

  it('pick up text that matches one of their values when a field becomes a list', () => {
    const before: ForgePressSchema = { collections: { post: { fields: { stage: { type: 'text', optional: true } } } } }
    const after: ForgePressSchema = { collections: { post: { fields: { stage: { type: 'list', values: ['Draft', 'Final'], optional: true } as Field } } } }
    const migration = planMigration({ before, after, content: { post: [post({ stage: ' draft ' }), { ...post({ stage: 'maybe' }), id: 'post_2' }] } })

    expect(migration.changeset.write.map(write => write.entry.stage)).toEqual(['Draft', undefined])
    expect(migration.effects.map(effect => effect.kind)).toEqual(['converted', 'lost'])
  })
})
