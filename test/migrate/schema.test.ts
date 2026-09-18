import type { SchemaDraft } from '../../src/migrate/schema'
import { describe, expect, it } from 'vitest'
import { linksTo, removeCollection, removeLocale, renameCollection, renameField, renameLocale, setDefaultLocale } from '../../src/migrate/schema'

function draft(): SchemaDraft {
  return {
    locales: ['en', 'de'],
    collections: {
      author: { fields: { name: { type: 'text', translate: true } } },
      post: {
        fields: {
          title: { type: 'text', translate: true },
          by: { type: 'relation', collection: 'author' },
          blocks: { type: 'dynamic', collections: ['author', 'hero'] },
        },
      },
      hero: { fields: {} },
    },
  }
}

describe('schema changes', () => {
  it('renames a collection in place and in every field that links to it', () => {
    const schema = draft()

    renameCollection(schema, 'author', 'writer')

    expect(Object.keys(schema.collections)).toEqual(['writer', 'post', 'hero'])
    expect(schema.collections.post!.fields).toMatchObject({ by: { collection: 'writer' }, blocks: { collections: ['writer', 'hero'] } })
  })

  it('removes a collection together with the links to it', () => {
    const schema = draft()

    expect(linksTo(schema, 'author')).toEqual([{ collection: 'post', field: 'by' }, { collection: 'post', field: 'blocks' }])

    removeCollection(schema, 'author')

    expect(Object.keys(schema.collections)).toEqual(['post', 'hero'])
    expect(schema.collections.post!.fields).toEqual({ title: { type: 'text', translate: true }, blocks: { type: 'dynamic', collections: ['hero'] } })
  })

  it('renames a field where it stands', () => {
    const schema = draft()

    renameField(schema, 'post', 'by', 'author')

    expect(Object.keys(schema.collections.post!.fields)).toEqual(['title', 'author', 'blocks'])
  })

  it('keeps the default locale through renames and removals', () => {
    const schema = { ...draft(), locales: ['en', 'de', 'fr'], defaultLocale: 'de' }

    renameLocale(schema, 'de', 'de-AT')
    expect(schema.defaultLocale).toBe('de-AT')

    removeLocale(schema, 'de-AT')
    expect(schema.locales).toEqual(['en', 'fr'])
    expect(schema.defaultLocale).toBe('en')

    setDefaultLocale(schema, 'fr')
    expect(schema.defaultLocale).toBe('fr')

    removeLocale(schema, 'en')
    expect(schema.locales).toEqual(['fr'])
    expect(schema).not.toHaveProperty('defaultLocale')
  })

  it('renames and removes locales, and stops translating after the last one', () => {
    const schema = draft()

    renameLocale(schema, 'de', 'de-AT')
    expect(schema.locales).toEqual(['en', 'de-AT'])

    removeLocale(schema, 'en')
    expect(schema.locales).toEqual(['de-AT'])

    removeLocale(schema, 'de-AT')
    expect(schema).not.toHaveProperty('locales')
    expect(schema.collections.post!.fields.title).toEqual({ type: 'text' })
  })
})
