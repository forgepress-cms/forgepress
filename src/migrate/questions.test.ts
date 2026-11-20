import type { Entry } from '../entries/types'
import type { ComponentDefinition, Schema } from '../schema/types'
import { describe, expect, it } from 'vitest'
import { renameQuestions } from './questions'

function entry(id: string, fields: Record<string, unknown>): Entry {
  return { id, status: 'published', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...fields }
}

describe('rename questions', () => {
  it('asks whether a field that is gone was renamed to an empty new field', () => {
    const before: Schema = { collections: { post: { fields: { heading: { type: 'text' }, body: { type: 'text' } } } } }
    const after: Schema = { collections: { post: { fields: { title: { type: 'text' }, body: { type: 'text' } } } } }
    const content = { post: [entry('post_1', { heading: 'Hi', body: 'Text' })] }

    expect(renameQuestions({ before, after, content })).toEqual([{ kind: 'field', collection: 'post', from: 'heading', to: ['title'] }])
    expect(renameQuestions({ before, after, content, renames: { fields: { post: { heading: 'title' } } } })).toEqual([])
  })

  it('does not ask about fields without content or without a place to go', () => {
    const before: Schema = { collections: { post: { fields: { heading: { type: 'text' }, body: { type: 'text' } } } } }
    const after: Schema = { collections: { post: { fields: { body: { type: 'text' } } } } }

    expect(renameQuestions({ before, after, content: { post: [entry('post_1', { heading: 'Hi', body: 'Text' })] } })).toEqual([])
    expect(renameQuestions({ before, after: { collections: { post: { fields: { title: { type: 'text' } } } } }, content: { post: [entry('post_1', {})] } })).toEqual([])
  })

  it('finds renames in content alone while repairing', () => {
    const current: Schema = { locales: ['en', 'fr'], collections: { article: { fields: { title: { type: 'text', translate: true } } } } }
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

describe('component rename questions', () => {
  function schema(components: Record<string, ComponentDefinition>): Schema {
    return {
      locales: ['en', 'de'],
      components,
      collections: { page: { fields: { cards: { type: 'component', components: [Object.keys(components)[0]!], multiple: true, optional: true } } } },
    }
  }

  const card: ComponentDefinition = { fields: { title: { type: 'text' }, count: { type: 'text', optional: true } } }
  const content = { page: [entry('page_1', { cards: [{ title: 'One', count: '3' }, { title: 'Two' }] })] }

  it('asks about components and component fields that are gone', () => {
    const before = schema({ card })
    const renamed = schema({ tile: card })
    const reshaped = schema({ card: { fields: { heading: { type: 'text' }, count: { type: 'text', optional: true } } } })

    expect(renameQuestions({ before, after: renamed, content })).toEqual([{ kind: 'component', from: 'card', to: ['tile'] }])
    expect(renameQuestions({ before, after: renamed, content, renames: { components: { card: 'tile' } } })).toEqual([])
    expect(renameQuestions({ before, after: reshaped, content })).toEqual([{ kind: 'field', component: 'card', from: 'title', to: ['heading'] }])
  })
})
