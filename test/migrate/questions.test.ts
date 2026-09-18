import type { Entry } from '../../src/entries/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { renameQuestions } from '../../src/migrate/questions'

function entry(id: string, fields: Record<string, unknown>): Entry {
  return { id, status: 'published', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...fields }
}

describe('rename questions', () => {
  it('asks whether a field that is gone was renamed to an empty new field', () => {
    const before: ForgePressSchema = { collections: { post: { fields: { heading: { type: 'text' }, body: { type: 'text' } } } } }
    const after: ForgePressSchema = { collections: { post: { fields: { title: { type: 'text' }, body: { type: 'text' } } } } }
    const content = { post: [entry('post_1', { heading: 'Hi', body: 'Text' })] }

    expect(renameQuestions({ before, after, content })).toEqual([{ kind: 'field', collection: 'post', from: 'heading', to: ['title'] }])
    expect(renameQuestions({ before, after, content, renames: { fields: { post: { heading: 'title' } } } })).toEqual([])
  })

  it('does not ask about fields without content or without a place to go', () => {
    const before: ForgePressSchema = { collections: { post: { fields: { heading: { type: 'text' }, body: { type: 'text' } } } } }
    const after: ForgePressSchema = { collections: { post: { fields: { body: { type: 'text' } } } } }

    expect(renameQuestions({ before, after, content: { post: [entry('post_1', { heading: 'Hi', body: 'Text' })] } })).toEqual([])
    expect(renameQuestions({ before, after: { collections: { post: { fields: { title: { type: 'text' } } } } }, content: { post: [entry('post_1', {})] } })).toEqual([])
  })

  it('finds renames in content alone while repairing', () => {
    const current: ForgePressSchema = { locales: ['en', 'fr'], collections: { article: { fields: { title: { type: 'text', translate: true } } } } }
    const content = { post: [entry('post_1', { heading: { en: 'Hi', de: 'Hallo' } })] }

    expect(renameQuestions({ before: current, after: current, content, repair: true })).toEqual([
      { kind: 'collection', from: 'post', to: ['article'] },
    ])

    expect(renameQuestions({ before: current, after: current, content, repair: true, renames: { collections: { post: 'article' } } })).toEqual([
      { kind: 'field', collection: 'article', from: 'heading', to: ['title'] },
    ])

    expect(renameQuestions({ before: current, after: current, content, repair: true, renames: { collections: { post: 'article' }, fields: { article: { heading: 'title' } } } })).toEqual([
      { kind: 'locale', from: 'de', to: ['fr'] },
    ])
  })
})
