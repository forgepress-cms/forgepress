import type { Entry } from '../../src/entries/types'
import type { MigrationInput } from '../../src/migrate/types'
import type { Field } from '../../src/schema/fields'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { planMigration } from '../../src/migrate/plan'

const NOW = '2026-09-17T10:00:00.000Z'

function entry(id: string, fields: Record<string, unknown> = {}, status: Entry['status'] = 'published'): Entry {
  return { id, status, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...fields }
}

function schema(fields: Record<string, Field>, extra: Partial<ForgePressSchema> = {}): ForgePressSchema {
  return { ...extra, collections: { ...extra.collections, post: { fields } } }
}

function plan(input: Partial<MigrationInput> & Pick<MigrationInput, 'before' | 'after' | 'content'>) {
  let count = 0

  return planMigration({ now: NOW, id: collection => `${collection}_new${++count}`, ...input })
}

function field(before: Field, after: Field, value: unknown, locales: string[] = ['en', 'de']) {
  const content = { post: [entry('post_1', value === undefined ? {} : { cover: value })] }
  const migration = plan({ before: schema({ cover: before }, { locales }), after: schema({ cover: after }, { locales }), content })
  const written = migration.changeset.write[0]?.entry

  return { migration, row: written ?? content.post[0]!, kinds: migration.effects.map(effect => effect.kind) }
}

const hero = { url: '/uploads/hero.png', width: 1920, height: 1080 }
const banner = { url: '/uploads/banner.png' }

describe('multiplicity', () => {
  const image = { type: 'image', optional: true } as Field
  const images = { type: 'image', multiple: true, optional: true } as Field

  it('wraps a single value when a field becomes multiple', () => {
    const { row, kinds } = field(image, images, hero)

    expect(row.cover).toEqual([hero])
    expect(kinds).toEqual(['converted'])
  })

  it('keeps the first value when a field stops being multiple', () => {
    const { row, migration } = field(images, image, [hero, banner])

    expect(row.cover).toEqual(hero)
    expect(migration.effects).toMatchObject([{ kind: 'lost', field: 'cover', before: [banner], after: hero }])
  })

  it('loses nothing when the list holds one value', () => {
    expect(field(images, image, [hero]).kinds).toEqual(['converted'])
  })

  it('leaves an empty field empty and the entry unwritten', () => {
    const { migration } = field(image, images, undefined)

    expect(migration.changeset.write).toEqual([])
    expect(migration.effects).toEqual([])
  })

  it('keeps the field where it sits in the entry', () => {
    const content = { post: [entry('post_1', { cover: hero, title: 'Hi' })] }
    const migration = plan({
      before: schema({ title: { type: 'text' }, cover: image }),
      after: schema({ title: { type: 'text' }, cover: images }),
      content,
    })

    expect(Object.keys(migration.changeset.write[0]!.entry)).toEqual(['id', 'status', 'createdAt', 'updatedAt', 'cover', 'title'])
  })

  it('keeps an empty list a required list field holds', () => {
    const blocks = { type: 'dynamic', collections: ['post'] } as Field

    expect(field(blocks, blocks, []).migration.effects).toEqual([])
  })
})

describe('types', () => {
  const text = { type: 'text', optional: true } as Field
  const richtext = { type: 'richtext', optional: true } as Field
  const number = { type: 'number', optional: true } as Field
  const image = { type: 'image', optional: true } as Field
  const video = { type: 'video', optional: true } as Field

  it('keeps text through a richtext change', () => {
    expect(field(text, richtext, 'Hello').row.cover).toBe('Hello')
  })

  it('reads a number out of text and back', () => {
    expect(field(text, number, ' 42 ').row.cover).toBe(42)
    expect(field(number, text, 42).row.cover).toBe('42')
  })

  it('drops text that is not a number', () => {
    const { row, kinds } = field(text, number, 'many')

    expect(row).not.toHaveProperty('cover')
    expect(kinds).toEqual(['lost'])
  })

  it('keeps media across image and video, without options media does not have', () => {
    expect(field(image, video, { ...hero, caption: 'x' }).row.cover).toEqual(hero)
  })

  it('turns an address into media', () => {
    expect(field(text, image, '/uploads/hero.png').row.cover).toEqual({ url: '/uploads/hero.png' })
    expect(field(text, image, 'a hero').kinds).toEqual(['lost'])
  })

  it('drops a value the new type cannot hold', () => {
    expect(field(image, text, hero).row).not.toHaveProperty('cover')
  })
})

describe('translation', () => {
  const plain = { type: 'text', optional: true } as Field
  const translated = { type: 'text', translate: true, optional: true } as Field

  it('moves a plain value onto the default locale', () => {
    expect(field(plain, translated, 'Hello').row.cover).toEqual({ en: 'Hello' })
  })

  it('keeps the default locale when translation is turned off', () => {
    const { row, migration } = field(translated, plain, { en: 'Hello', de: 'Hallo', fr: '' })

    expect(row.cover).toBe('Hello')
    expect(migration.effects).toMatchObject([
      { kind: 'converted', locale: 'en', before: 'Hello', after: 'Hello' },
      { kind: 'lost', locale: 'de', before: 'Hallo' },
    ])
  })

  it('keeps the locale the schema calls the default, not the first one', () => {
    const content = { post: [entry('post_1', { cover: { en: 'Hello', de: 'Hallo' } })] }
    const locales = ['en', 'de']
    const migration = plan({
      before: schema({ cover: translated }, { locales, defaultLocale: 'de' }),
      after: schema({ cover: plain }, { locales, defaultLocale: 'de' }),
      content,
    })

    expect(migration.changeset.write[0]?.entry.cover).toBe('Hallo')
  })

  it('falls back to another locale when the default is empty', () => {
    expect(field(translated, plain, { de: 'Hallo' }).row.cover).toBe('Hallo')
  })

  it('converts every locale in place', () => {
    const numbers = { type: 'number', translate: true, optional: true } as Field

    expect(field(translated, numbers, { en: '1', de: '2' }).row.cover).toEqual({ en: 1, de: 2 })
  })
})

describe('relations', () => {
  const authors = {
    locales: ['en'],
    collections: {
      author: { fields: { name: { type: 'text' } } },
      tag: { fields: { name: { type: 'text' } } },
    },
  } satisfies Partial<ForgePressSchema>

  const content = {
    author: [entry('author_ada', { name: 'Ada Lovelace' }), entry('author_bob', { name: 'Bob' }, 'unpublished')],
    tag: [],
  }

  function relate(before: Field, after: Field, value: unknown, create = false) {
    const migration = plan({
      before: schema({ by: before }, authors),
      after: schema({ by: after }, authors),
      content: { ...content, post: [entry('post_1', { by: value })] },
      decisions: create ? { create: { post: ['by'] } } : undefined,
    })

    return { migration, row: migration.changeset.write.find(write => write.collection === 'post')?.entry }
  }

  const one = { type: 'relation', collection: 'author', optional: true } as Field
  const list = { type: 'relation', collection: 'author', multiple: true, optional: true } as Field
  const other = { type: 'relation', collection: 'tag', optional: true } as Field
  const text = { type: 'text', optional: true } as Field

  it('wraps and unwraps ids', () => {
    expect(relate(one, list, 'author_ada').row?.by).toEqual(['author_ada'])
    expect(relate(list, one, ['author_ada', 'author_bob']).row?.by).toBe('author_ada')
  })

  it('drops ids that point at another collection', () => {
    const { row, migration } = relate(one, other, 'author_ada')

    expect(row).not.toHaveProperty('by')
    expect(migration.effects.map(effect => effect.kind)).toEqual(['lost'])
  })

  it('writes the title of the linked entry when a relation becomes text', () => {
    expect(relate(one, text, 'author_ada').row?.by).toBe('Ada Lovelace')
  })

  it('links text to the entry with that title', () => {
    expect(relate(text, one, '  ada   LOVELACE ').row?.by).toBe('author_ada')
  })

  it('reports text without a matching entry', () => {
    const { row, migration } = relate(text, one, 'Grace Hopper')

    expect(row).not.toHaveProperty('by')
    expect(migration.effects).toMatchObject([{ kind: 'unmatched', collection: 'post', field: 'by', before: 'Grace Hopper' }])
  })

  it('creates entries for text without a match once, published when linked from published content', () => {
    const migration = plan({
      before: schema({ by: text }, authors),
      after: schema({ by: one }, authors),
      content: { ...content, post: [entry('post_1', { by: 'Grace Hopper' }), entry('post_2', { by: 'grace hopper' }, 'unpublished')] },
      decisions: { create: { post: ['by'] } },
    })

    expect(migration.changeset.write.map(write => [write.collection, write.entry])).toEqual([
      ['post', expect.objectContaining({ id: 'post_1', by: 'author_new1' })],
      ['post', expect.objectContaining({ id: 'post_2', by: 'author_new1' })],
      ['author', { id: 'author_new1', status: 'published', createdAt: NOW, updatedAt: NOW, name: 'Grace Hopper' }],
    ])
    expect(migration.effects.filter(effect => effect.kind === 'created')).toMatchObject([{ collection: 'author', id: 'author_new1', title: 'Grace Hopper' }])
  })

  it('keeps ids of an unchanged relation even when the entry is gone', () => {
    expect(relate(one, one, 'author_gone').migration.changeset.write).toEqual([])
  })
})

describe('dynamic', () => {
  const blocks = { collections: { hero: { fields: {} }, textBlock: { fields: {} } } } satisfies Partial<ForgePressSchema>
  const wide = { type: 'dynamic', collections: ['hero', 'textBlock'], optional: true } as Field
  const narrow = { type: 'dynamic', collections: ['hero'], optional: true } as Field

  it('drops blocks whose collection is no longer allowed', () => {
    const value = [{ collection: 'hero', id: 'hero_1' }, { collection: 'textBlock', id: 'textBlock_1' }]
    const migration = plan({ before: schema({ blocks: wide }, blocks), after: schema({ blocks: narrow }, blocks), content: { post: [entry('post_1', { blocks: value })] } })

    expect(migration.changeset.write[0]!.entry.blocks).toEqual([value[0]])
    expect(migration.effects).toMatchObject([{ kind: 'lost', before: [value[1]] }])
  })

  it('turns a relation into blocks of its collection', () => {
    const relation = { type: 'relation', collection: 'hero', multiple: true, optional: true } as Field
    const migration = plan({ before: schema({ blocks: relation }, blocks), after: schema({ blocks: wide }, blocks), content: { post: [entry('post_1', { blocks: ['hero_1'] })] } })

    expect(migration.changeset.write[0]!.entry.blocks).toEqual([{ collection: 'hero', id: 'hero_1' }])
  })
})

describe('renames', () => {
  it('moves a renamed field without converting it', () => {
    const migration = plan({
      before: schema({ heading: { type: 'text' }, body: { type: 'richtext' } }),
      after: schema({ title: { type: 'text' }, body: { type: 'richtext' } }),
      content: { post: [entry('post_1', { heading: 'Hello', body: 'Text' })] },
      renames: { fields: { post: { heading: 'title' } } },
    })

    expect(migration.changeset.write[0]!.entry).toEqual(entry('post_1', { title: 'Hello', body: 'Text' }))
    expect(migration.effects).toMatchObject([{ kind: 'converted', field: 'title', before: 'Hello', after: 'Hello' }])
  })

  it('moves a renamed collection and every link to it', () => {
    const before: ForgePressSchema = {
      collections: {
        writer: { fields: { name: { type: 'text' } } },
        post: { fields: { by: { type: 'relation', collection: 'writer' }, blocks: { type: 'dynamic', collections: ['writer'], optional: true } } },
      },
    }
    const after: ForgePressSchema = {
      collections: {
        author: { fields: { name: { type: 'text' } } },
        post: { fields: { by: { type: 'relation', collection: 'author' }, blocks: { type: 'dynamic', collections: ['author'], optional: true } } },
      },
    }
    const migration = plan({
      before,
      after,
      content: { writer: [entry('writer_1', { name: 'Ada' })], post: [entry('post_1', { by: 'writer_1', blocks: [{ collection: 'writer', id: 'writer_1' }] })] },
      renames: { collections: { writer: 'author' } },
    })

    expect(migration.changeset.collections).toEqual(['writer'])
    expect(migration.changeset.write).toEqual([
      { collection: 'author', entry: entry('writer_1', { name: 'Ada' }) },
      { collection: 'post', entry: entry('post_1', { by: 'writer_1', blocks: [{ collection: 'author', id: 'writer_1' }] }) },
    ])
    expect(migration.effects.map(effect => effect.kind)).toEqual(['converted'])
    expect(migration.blocked).toEqual([])
  })

  it('refuses to merge two collections into one', () => {
    const before: ForgePressSchema = { collections: { a: { fields: {} }, b: { fields: {} } } }
    const after: ForgePressSchema = { collections: { b: { fields: {} } } }

    expect(plan({ before, after, content: {}, renames: { collections: { a: 'b' } } }).blocked).toEqual(['b and a would both become b'])
  })

  it('renames a locale in every translated value', () => {
    const translated = { type: 'text', translate: true } as Field
    const migration = plan({
      before: schema({ title: translated }, { locales: ['en', 'de'] }),
      after: schema({ title: translated }, { locales: ['en', 'de-AT'] }),
      content: { post: [entry('post_1', { title: { en: 'Hello', de: 'Hallo' } })] },
      renames: { locales: { de: 'de-AT' } },
    })

    expect(migration.changeset.write[0]!.entry.title).toEqual({ 'en': 'Hello', 'de-AT': 'Hallo' })
    expect(migration.effects).toMatchObject([{ kind: 'converted', locale: 'de' }])
  })
})

describe('locales', () => {
  const title = { type: 'text', translate: true } as Field
  const summary = { type: 'text', translate: true, optional: true } as Field
  const rows = { post: [entry('post_1', { title: { en: 'Hello' }, summary: { en: 'Hi' } }), entry('post_2', { title: { en: 'Bye' } })] }

  it('asks for the values a new locale needs in required fields', () => {
    const migration = plan({ before: schema({ title, summary }, { locales: ['en'] }), after: schema({ title, summary }, { locales: ['en', 'de'] }), content: rows })

    expect(migration.changeset.write).toEqual([])
    expect(migration.effects).toMatchObject([
      { kind: 'missing', id: 'post_1', title: 'Hello', field: 'title', locale: 'de' },
      { kind: 'missing', id: 'post_2', title: 'Bye', field: 'title', locale: 'de' },
    ])
  })

  it('starts a new locale from the default one when asked to', () => {
    const migration = plan({
      before: schema({ title, summary }, { locales: ['en'] }),
      after: schema({ title, summary }, { locales: ['en', 'de'] }),
      content: rows,
      decisions: { fills: { post: { title: { type: 'locale', locale: 'en' } } } },
    })

    expect(migration.changeset.write.map(write => write.entry.title)).toEqual([{ en: 'Hello', de: 'Hello' }, { en: 'Bye', de: 'Bye' }])
    expect(migration.effects).toEqual([])
  })

  it('drops the translations of a removed locale', () => {
    const migration = plan({
      before: schema({ title }, { locales: ['en', 'de'] }),
      after: schema({ title }, { locales: ['en'] }),
      content: { post: [entry('post_1', { title: { en: 'Hello', de: 'Hallo' } })] },
    })

    expect(migration.changeset.write[0]!.entry.title).toEqual({ en: 'Hello' })
    expect(migration.effects).toMatchObject([{ kind: 'lost', locale: 'de', before: 'Hallo' }])
  })

  it('keeps the values of the last locale as plain values', () => {
    const migration = plan({
      before: schema({ title }, { locales: ['en'] }),
      after: schema({ title: { type: 'text' } }),
      content: { post: [entry('post_1', { title: { en: 'Hello' } })] },
    })

    expect(migration.changeset.write[0]!.entry.title).toBe('Hello')
    expect(migration.effects.map(effect => effect.kind)).toEqual(['converted'])
  })

  it('does not report translations that were already missing', () => {
    const migration = plan({
      before: schema({ title }, { locales: ['en', 'de'] }),
      after: schema({ title }, { locales: ['en', 'de'] }),
      content: { post: [entry('post_1', { title: { en: 'Hello' } })] },
    })

    expect(migration.effects).toEqual([])
  })
})

describe('required values', () => {
  const optional = { type: 'text', optional: true } as Field
  const required = { type: 'text' } as Field
  const rows = { post: [entry('post_1', { title: 'Hello World', slug: undefined }), entry('post_2', { title: 'Über uns' })] }

  it('reports entries a new required field has no value for', () => {
    const migration = plan({ before: schema({ title: required }), after: schema({ title: required, slug: required }), content: rows })

    expect(migration.effects).toMatchObject([
      { kind: 'missing', id: 'post_1', field: 'slug' },
      { kind: 'missing', id: 'post_2', field: 'slug' },
    ])
  })

  it('fills a fixed value, a copy or a slug', () => {
    const fills = (fill: object) => plan({
      before: schema({ title: required, slug: optional }),
      after: schema({ title: required, slug: required }),
      content: rows,
      decisions: { fills: { post: { slug: fill as never } } },
    }).changeset.write.map(write => write.entry.slug)

    expect(fills({ type: 'value', value: 'draft' })).toEqual(['draft', 'draft'])
    expect(fills({ type: 'field', field: 'title' })).toEqual(['Hello World', 'Über uns'])
    expect(fills({ type: 'slug', field: 'title' })).toEqual(['hello-world', 'uber-uns'])
  })

  it('leaves values empty when asked to', () => {
    const migration = plan({
      before: schema({ title: optional }),
      after: schema({ title: required }),
      content: { post: [entry('post_1')] },
      decisions: { fills: { post: { title: { type: 'empty' } } } },
    })

    expect(migration.changeset.write).toEqual([])
    expect(migration.effects.map(effect => effect.kind)).toEqual(['missing'])
  })
})

describe('rules', () => {
  const loose = { type: 'number', optional: true } as Field
  const strict = { type: 'number', min: 0, max: 10, step: 2, optional: true } as Field
  const content = { post: [entry('post_1', { score: 13 }), entry('post_2', { score: 3 }), entry('post_3', { score: 4 })] }

  it('reports values a stricter field no longer accepts', () => {
    const migration = plan({ before: schema({ score: loose }), after: schema({ score: strict }), content })

    expect(migration.changeset.write).toEqual([])
    expect(migration.effects).toMatchObject([
      { kind: 'invalid', id: 'post_1', before: 13, message: 'Field "score" has to be at most 10' },
      { kind: 'invalid', id: 'post_2', before: 3 },
    ])
  })

  it('clears them or uses the nearest allowed number', () => {
    const fixed = (fix: 'clear' | 'nearest') => plan({ before: schema({ score: loose }), after: schema({ score: strict }), content, decisions: { fixes: { post: { score: fix } } } })

    expect(fixed('clear').changeset.write.map(write => write.entry)).toEqual([entry('post_1'), entry('post_2')])
    expect(fixed('nearest').changeset.write.map(write => write.entry.score)).toEqual([10, 4])
    expect(fixed('nearest').effects).toEqual([])
  })

  it('does not report values that already broke the rules', () => {
    expect(plan({ before: schema({ score: strict }), after: schema({ score: strict }), content }).effects).toEqual([])
  })
})

describe('collections', () => {
  it('removes the entries of a removed collection', () => {
    const before: ForgePressSchema = { collections: { post: { fields: { title: { type: 'text' } } }, author: { fields: {} } } }
    const after: ForgePressSchema = { collections: { author: { fields: {} } } }
    const migration = plan({ before, after, content: { post: [entry('post_1', { title: 'Hello' })] } })

    expect(migration.changeset.collections).toEqual(['post'])
    expect(migration.effects).toEqual([{ kind: 'removed', collection: 'post', id: 'post_1', title: 'Hello' }])
  })

  it('leaves folders that are not in the schema alone unless it repairs', () => {
    const current: ForgePressSchema = { collections: {} }
    const content = { stray: [entry('stray_1')] }

    expect(plan({ before: current, after: current, content }).changeset.collections).toEqual([])
    expect(plan({ before: current, after: current, content, repair: true }).changeset.collections).toEqual(['stray'])
  })
})

describe('repairs', () => {
  const current = schema({ title: { type: 'text' }, rating: { type: 'number', optional: true } })

  it('keeps keys the schema does not know while editing the schema', () => {
    const migration = plan({ before: current, after: current, content: { post: [entry('post_1', { title: 'Hi', colour: 'red' })] } })

    expect(migration.effects).toEqual([])
  })

  it('removes them and converts values that do not fit while repairing', () => {
    const migration = plan({ before: current, after: current, content: { post: [entry('post_1', { title: 'Hi', colour: 'red', rating: '4' })] }, repair: true })

    expect(migration.changeset.write[0]!.entry).toEqual(entry('post_1', { title: 'Hi', rating: 4 }))
    expect(migration.effects).toMatchObject([
      { kind: 'lost', field: 'colour', before: 'red' },
      { kind: 'converted', field: 'rating', before: '4', after: 4 },
    ])
  })

  it('moves values of a field renamed by hand once the rename is known', () => {
    const migration = plan({
      before: current,
      after: current,
      content: { post: [entry('post_1', { heading: 'Hi' })] },
      renames: { fields: { post: { heading: 'title' } } },
      repair: true,
    })

    expect(migration.changeset.write[0]!.entry).toEqual(entry('post_1', { title: 'Hi' }))
  })
})
