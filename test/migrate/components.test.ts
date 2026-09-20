import type { Entry } from '../../src/entries/types'
import type { MigrationInput } from '../../src/migrate/types'
import type { Component, ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { planMigration } from '../../src/migrate/plan'
import { renameQuestions } from '../../src/migrate/questions'

function entry(id: string, fields: Record<string, unknown> = {}): Entry {
  return { id, status: 'published', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...fields }
}

function schema(components: Record<string, Component>, translate = false, names?: string[]): ForgePressSchema {
  const picked = names ?? [Object.keys(components)[0]!]

  return {
    locales: ['en', 'de'],
    components,
    collections: { page: { fields: { cards: { type: 'component', components: picked, multiple: true, optional: true, ...translate ? { translate: true } : {} } } } },
  }
}

function plan(input: Pick<MigrationInput, 'before' | 'after' | 'content'> & Partial<MigrationInput>) {
  return planMigration({ now: '2026-09-17T10:00:00.000Z', ...input })
}

const card: Component = { fields: { title: { type: 'text' }, count: { type: 'text', optional: true } } }
const content = { page: [entry('page_1', { cards: [{ title: 'One', count: '3' }, { title: 'Two' }] })] }

describe('migrating components', () => {
  it('leaves untouched items alone', () => {
    expect(plan({ before: schema({ card }), after: schema({ card }), content }).changeset.write).toEqual([])
  })

  it('converts, drops and defaults fields inside every item', () => {
    const after = schema({ card: { fields: { title: { type: 'text' }, count: { type: 'number', optional: true }, wide: { type: 'boolean', default: true } } } })
    const migration = plan({ before: schema({ card }), after, content })

    expect(migration.changeset.write[0]?.entry.cards).toEqual([{ title: 'One', count: 3, wide: true }, { title: 'Two', wide: true }])
    expect(migration.blocked).toEqual([])
  })

  it('follows renamed components and renamed fields inside them', () => {
    const after = schema({ tile: { fields: { heading: { type: 'text' }, count: { type: 'text', optional: true } } } })
    const migration = plan({ before: schema({ card }), after, content, renames: { components: { card: 'tile' }, componentFields: { tile: { title: 'heading' } } } })

    expect(migration.changeset.write[0]?.entry.cards).toEqual([{ heading: 'One', count: '3' }, { heading: 'Two' }])
  })

  it('drops items of a component the field no longer holds', () => {
    const after = schema({ tile: { fields: { title: { type: 'text' } } } })
    const migration = plan({ before: schema({ card }), after, content })

    expect(migration.changeset.write[0]?.entry.cards).toEqual([])
    expect(migration.effects.map(effect => effect.kind)).toEqual(['lost'])
  })

  it('names every item once the field holds more than one component', () => {
    const quote: Component = { fields: { saying: { type: 'text' } } }
    const after = schema({ card, quote }, false, ['card', 'quote'])
    const migration = plan({ before: schema({ card }), after, content })

    expect(migration.changeset.write[0]?.entry.cards).toEqual([
      { component: 'card', title: 'One', count: '3' },
      { component: 'card', title: 'Two' },
    ])
  })

  it('keeps the items of the one component left and drops the others', () => {
    const quote: Component = { fields: { saying: { type: 'text' } } }
    const before = schema({ card, quote }, false, ['card', 'quote'])
    const mixed = { page: [entry('page_1', { cards: [{ component: 'card', title: 'One' }, { component: 'quote', saying: 'Hi' }] })] }
    const migration = plan({ before, after: schema({ card, quote }, false, ['card']), content: mixed })

    expect(migration.changeset.write[0]?.entry.cards).toEqual([{ title: 'One' }])
    expect(migration.effects).toMatchObject([{ kind: 'lost', before: [{ component: 'quote', saying: 'Hi' }] }])
  })

  it('moves a list onto the default locale when the field becomes translated', () => {
    const migration = plan({ before: schema({ card }), after: schema({ card }, true), content })

    expect(migration.changeset.write[0]?.entry.cards).toEqual({ en: [{ title: 'One', count: '3' }, { title: 'Two' }] })
  })

  it('reports items missing a new required field, without offering fills', () => {
    const after = schema({ card: { fields: { ...card.fields, link: { type: 'text', label: 'Link' } } } })
    const migration = plan({ before: schema({ card }), after, content })

    expect(migration.effects).toMatchObject([{ kind: 'missing', id: 'page_1', field: 'cards.link', label: 'cards › Link' }])
  })
})

describe('component rename questions', () => {
  it('asks about components and component fields that are gone', () => {
    const before = schema({ card })
    const renamed = schema({ tile: card })
    const reshaped = schema({ card: { fields: { heading: { type: 'text' }, count: { type: 'text', optional: true } } } })

    expect(renameQuestions({ before, after: renamed, content })).toEqual([{ kind: 'component', from: 'card', to: ['tile'] }])
    expect(renameQuestions({ before, after: renamed, content, renames: { components: { card: 'tile' } } })).toEqual([])
    expect(renameQuestions({ before, after: reshaped, content })).toEqual([{ kind: 'field', component: 'card', from: 'title', to: ['heading'] }])
  })
})
