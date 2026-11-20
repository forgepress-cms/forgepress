import type { Schema } from './types'
import { describe, expect, it } from 'vitest'
import { validateSchema } from './validate'

function issues(schema: unknown): { path: readonly (string | number)[], message: string }[] {
  return validateSchema(schema)
}

function withField(field: unknown, extra: Record<string, unknown> = {}): unknown {
  return { locales: ['en'], ...extra, collections: { post: { fields: { field } }, author: { fields: {} } } }
}

describe('validateSchema', () => {
  it('accepts every field type with its options', () => {
    expect(issues({
      locales: ['en', 'de-CH', 'pt_BR'],
      collections: {
        author: {
          label: 'Author',
          description: 'People who write',
          fields: {
            name: { type: 'text', label: 'Name', validation: '^\\w+$', index: true },
            bio: { type: 'richtext', translate: true, optional: false },
            age: { type: 'number', min: 0, max: 120, step: 1, optional: true, index: false },
            portrait: { type: 'image', multiple: false },
            intro: { type: 'video', multiple: true },
            posts: { type: 'collection', collections: ['blogPost2'], multiple: true },
          },
        },
        blogPost2: {
          fields: {
            author: { type: 'collection', collections: ['author'], index: true },
            blocks: { type: 'collection', collections: ['author', 'blogPost2'], multiple: true },
            single: { type: 'collection', collections: ['author'], optional: true },
          },
        },
      },
    })).toEqual([])
  })

  it('accepts a schema without locales when nothing is translated', () => {
    expect(issues({ collections: { post: { fields: { title: { type: 'text', translate: false } } } } })).toEqual([])
  })

  it('wants an object with collections', () => {
    expect(issues([])).toEqual([{ path: [], message: 'The schema has to be an object' }])
    expect(issues({})).toEqual([{ path: [], message: 'The schema needs "collections" as an object' }])
    expect(issues({ collections: [] })).toEqual([{ path: ['collections'], message: 'The schema needs "collections" as an object' }])
  })

  it('rejects unknown schema options', () => {
    expect(issues({ locale: ['en'], collections: {} })).toEqual([{ path: ['locale'], message: 'The schema has no option "locale"' }])
  })

  it('checks the locale codes', () => {
    expect(issues({ locales: 'en', collections: {} })).toEqual([{ path: ['locales'], message: '"locales" has to be a list of locale codes' }])

    expect(issues({ locales: ['en', 'en US', 3, '', 'en'], collections: {} })).toEqual([
      { path: ['locales', 1], message: '"en US" is not a locale code' },
      { path: ['locales', 2], message: '3 is not a locale code' },
      { path: ['locales', 3], message: '"" is not a locale code' },
      { path: ['locales', 4], message: 'Locale "en" is listed twice' },
    ])
  })

  it('wants the default locale to be one of the locales', () => {
    expect(issues({ locales: ['en', 'de'], defaultLocale: 'de', collections: {} })).toEqual([])
    expect(issues({ locales: ['en', 'de'], defaultLocale: 'fr', collections: {} })).toEqual([{ path: ['defaultLocale'], message: 'The default locale "fr" is not in "locales"' }])
    expect(issues({ locales: ['en'], defaultLocale: 3, collections: {} })).toEqual([{ path: ['defaultLocale'], message: '"defaultLocale" has to be a locale code' }])
  })

  it.each(['blog-post', 'BlogPost', 'blog_post', '2posts', 'post$'])('rejects the collection name %j', (name) => {
    expect(issues({ collections: { [name]: { fields: {} } } })).toEqual([
      { path: ['collections', name], message: `Collection "${name}" has to start with a lowercase letter and contain only letters and digits` },
    ])
  })

  it('checks the collection options', () => {
    expect(issues({ collections: { post: 'nope' } })).toEqual([
      { path: ['collections', 'post'], message: 'Collection "post" has to be an object' },
    ])

    expect(issues({ collections: { post: { title: 'Post', label: 1, fields: {} } } })).toEqual([
      { path: ['collections', 'post', 'title'], message: 'Collection "post" has no option "title"' },
      { path: ['collections', 'post', 'label'], message: '"label" of collection "post" has to be a string' },
    ])

    expect(issues({ collections: { post: {} } })).toEqual([
      { path: ['collections', 'post'], message: 'Collection "post" needs "fields" as an object' },
    ])
  })

  it('reserves the entry metadata names', () => {
    expect(issues({ collections: { post: { fields: { id: { type: 'text' }, createdAt: { type: 'text' } } } } })).toEqual([
      { path: ['collections', 'post', 'fields', 'id'], message: 'Field "post.id" uses "id", which is reserved for entry metadata' },
      { path: ['collections', 'post', 'fields', 'createdAt'], message: 'Field "post.createdAt" uses "createdAt", which is reserved for entry metadata' },
    ])
  })

  it('wants every field to have a known type', () => {
    expect(issues(withField('text'))).toEqual([
      { path: ['collections', 'post', 'fields', 'field'], message: 'Field "post.field" has to be an object' },
    ])

    expect(issues(withField({ label: 'Field' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field'], message: 'Field "post.field" needs a type' },
    ])

    expect(issues(withField({ type: 'colour' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'type'], message: 'Field "post.field" has unknown type "colour"; use one of text, richtext, number, boolean, list, image, video, collection, component' },
    ])
  })

  it('rejects options the field type does not have', () => {
    expect(issues(withField({ type: 'text', multiple: true, colour: 'red' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'multiple'], message: 'Field "post.field" has no option "multiple"' },
      { path: ['collections', 'post', 'fields', 'field', 'colour'], message: 'Field "post.field" has no option "colour"' },
    ])
  })

  it('keeps booleans required, with a default instead', () => {
    expect(issues(withField({ type: 'boolean', default: true, index: true }))).toEqual([])
    expect(issues(withField({ type: 'boolean', optional: true, default: 'yes' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'optional'], message: 'Field "post.field" has no option "optional"' },
      { path: ['collections', 'post', 'fields', 'field', 'default'], message: '"default" of field "post.field" has to be true or false' },
    ])
  })

  it('indexes only text, number, boolean, list and collection fields', () => {
    for (const type of ['richtext', 'image', 'video']) {
      expect(issues(withField({ type, index: true }))).toEqual([
        { path: ['collections', 'post', 'fields', 'field', 'index'], message: 'Field "post.field" can\'t be indexed; only text, number, boolean, list and collection fields can' },
      ])
    }

    expect(issues(withField({ type: 'text', index: 'yes' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'index'], message: '"index" of field "post.field" has to be true or false' },
    ])
  })

  it('checks the option values', () => {
    expect(issues(withField({ type: 'number', min: '0', optional: 'yes', label: 3 }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'min'], message: '"min" of field "post.field" has to be a number' },
      { path: ['collections', 'post', 'fields', 'field', 'optional'], message: '"optional" of field "post.field" has to be true or false' },
      { path: ['collections', 'post', 'fields', 'field', 'label'], message: '"label" of field "post.field" has to be a string' },
    ])

    expect(issues(withField({ type: 'collection', collections: 'author' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collections'], message: '"collections" of field "post.field" has to be a list of collection names' },
    ])
  })

  it('takes text over several lines', () => {
    expect(issues(withField({ type: 'text', multiline: true }))).toEqual([])

    expect(issues(withField({ type: 'text', multiline: 'yes' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'multiline'], message: '"multiline" of field "post.field" has to be true or false' },
    ])
  })

  it('checks the field constraints', () => {
    expect(issues(withField({ type: 'text', validation: '[a-z' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'validation'], message: '"validation" of field "post.field" is not a valid regular expression: /[a-z/u: Unterminated character class' },
    ])

    expect(issues(withField({ type: 'number', min: 5, max: 1, step: 0 }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'step'], message: '"step" of field "post.field" has to be greater than 0' },
      { path: ['collections', 'post', 'fields', 'field', 'min'], message: '"min" of field "post.field" can\'t be greater than "max"' },
    ])

    expect(issues(withField({ type: 'number', min: Number.NaN }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'min'], message: '"min" of field "post.field" has to be a number' },
    ])

    expect(issues(withField({ type: 'number', min: 1, max: 1, step: 0.25 }))).toEqual([])
  })

  it('wants the required options', () => {
    expect(issues(withField({ type: 'collection' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field'], message: 'Field "post.field" needs "collections"' },
    ])

    expect(issues(withField({ type: 'component' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field'], message: 'Field "post.field" needs "components"' },
    ])
  })

  it('wants references to point at collections in the schema', () => {
    expect(issues(withField({ type: 'collection', collections: ['autor'] }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collections', 0], message: 'Field "post.field" references unknown collection "autor"' },
    ])

    expect(issues(withField({ type: 'collection', collections: [] }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collections'], message: 'Field "post.field" needs at least one collection' },
    ])

    expect(issues(withField({ type: 'collection', collections: ['author', 'hero', 'author'], multiple: true }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collections', 1], message: 'Field "post.field" references unknown collection "hero"' },
      { path: ['collections', 'post', 'fields', 'field', 'collections', 2], message: 'Field "post.field" lists collection "author" twice' },
    ])
  })

  it('lets a collection reference itself', () => {
    expect(issues(withField({ type: 'collection', collections: ['post'] }))).toEqual([])
  })

  it('wants locales before a field can be translated', () => {
    const translated = { type: 'text', translate: true }

    expect(issues(withField(translated, { locales: undefined }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'translate'], message: 'Field "post.field" is translated, but the schema has no locales' },
    ])

    expect(issues(withField(translated, { locales: [] }))).toHaveLength(1)
    expect(issues(withField(translated))).toEqual([])
  })

  it('reports every problem at once', () => {
    expect(issues({
      locales: ['en', 'en'],
      collections: {
        'post': { fields: { title: { type: 'txt' } } },
        'bad-name': { fields: { link: { type: 'collection', collections: ['nowhere'] } } },
      },
    })).toHaveLength(4)
  })

  describe('components in the schema', () => {
    function schema(extra: Record<string, unknown>): unknown {
      return {
        locales: ['en', 'de'],
        components: { card: { fields: { title: { type: 'text' } } } },
        collections: { page: { fields: { cards: { type: 'component', components: ['card'], multiple: true, translate: true } } } },
        ...extra,
      }
    }

    it('accepts collections holding components', () => {
      expect(validateSchema(schema({}))).toEqual([])
    })

    it('wants a component field to name a component', () => {
      expect(validateSchema(schema({ collections: { page: { fields: { cards: { type: 'component', components: ['tile'] }, hero: { type: 'component' } } } } }))).toEqual([
        { path: ['collections', 'page', 'fields', 'cards', 'components', 0], message: 'Field "page.cards" references unknown component "tile"' },
        { path: ['collections', 'page', 'fields', 'hero'], message: 'Field "page.hero" needs "components"' },
      ])
    })

    it('keeps indexes out of components', () => {
      expect(validateSchema(schema({ components: { card: { fields: { title: { type: 'text', index: true } } } } }))).toEqual([
        { path: ['components', 'card', 'fields', 'title', 'index'], message: 'Field "card.title" is inside a component and can\'t be indexed' },
      ])
    })

    it('translates a field inside a component, but not both it and the field holding it', () => {
      const translating = { card: { fields: { title: { type: 'text', translate: true } } } }

      expect(validateSchema(schema({
        components: translating,
        collections: { page: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } } },
      }))).toEqual([])

      expect(validateSchema(schema({ components: translating }))).toEqual([
        { path: ['collections', 'page', 'fields', 'cards', 'translate'], message: 'Field "page.cards" is translated, and so is component "card"; translate one or the other' },
      ])
    })

    it('sees translations through nested components', () => {
      expect(validateSchema(schema({
        components: {
          card: { fields: { title: { type: 'text', translate: true } } },
          grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
        },
        collections: { page: { fields: { grid: { type: 'component', components: ['grid'], translate: true } } } },
      }))).toEqual([
        { path: ['collections', 'page', 'fields', 'grid', 'translate'], message: 'Field "page.grid" is translated, and so is component "grid"; translate one or the other' },
      ])
    })

    it('checks component names and definitions like collections', () => {
      expect(validateSchema(schema({ components: { 'Card': { fields: {} }, 'hero': 'big', 'x-y': { label: 3 } } }))).toEqual([
        { path: ['components', 'Card'], message: 'Component "Card" has to start with a lowercase letter and contain only letters and digits' },
        { path: ['components', 'hero'], message: 'Component "hero" has to be an object' },
        { path: ['components', 'x-y'], message: 'Component "x-y" has to start with a lowercase letter and contain only letters and digits' },
        { path: ['components', 'x-y', 'label'], message: '"label" of component "x-y" has to be a string' },
        { path: ['components', 'x-y'], message: 'Component "x-y" needs "fields" as an object' },
        { path: ['collections', 'page', 'fields', 'cards', 'components', 0], message: 'Field "page.cards" references unknown component "card"' },
      ])
    })

    it('keeps "component" free inside a component, since items carry their name there', () => {
      expect(validateSchema(schema({
        components: { card: { fields: { component: { type: 'text' } } } },
        collections: { page: { fields: { cards: { type: 'component', components: ['card'] } } } },
      }))).toEqual([
        { path: ['components', 'card', 'fields', 'component'], message: 'Field "card.component" uses "component", which is reserved for the component an item holds' },
      ])
    })

    it('lets components hold other components, but not themselves', () => {
      const nested = { grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } }, card: { fields: { title: { type: 'text' } } } }

      expect(validateSchema(schema({ components: nested }))).toEqual([])

      const looped = { a: { fields: { b: { type: 'component', components: ['b'] } } }, b: { fields: { a: { type: 'component', components: ['a'], optional: true } } }, card: { fields: {} } }

      expect(validateSchema(schema({ components: looped }))).toEqual([
        { path: ['components', 'a'], message: 'Component "a" includes itself through a → b → a' },
      ])
    })
  })

  describe('list fields', () => {
    const schema = {
      collections: {
        post: {
          fields: {
            stage: { type: 'list', values: ['draft', 'review', 'final'] },
            tags: { type: 'list', values: ['news', 'guide'], multiple: true, optional: true },
          },
        },
      },
    } as const satisfies Schema

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
  })

  describe('preview addresses', () => {
    const path = ['collections', 'post', 'preview']

    function schema(preview: unknown, extra: Record<string, unknown> = {}): unknown {
      return {
        locales: ['en'],
        ...extra,
        collections: {
          post: {
            preview,
            fields: {
              slug: { type: 'text' },
              rank: { type: 'number' },
              stage: { type: 'list', values: ['draft', 'final'] },
              tags: { type: 'list', values: ['news', 'guide'], multiple: true },
              body: { type: 'richtext' },
            },
          },
        },
      }
    }

    it('accept a path on the site built from the id, the locale and plain fields', () => {
      expect(issues(schema('/{locale}/{stage}/{slug}?rank={rank}&id={id}'))).toEqual([])
      expect(issues(schema('{slug}'))).toEqual([])
      expect(issues(schema('/'))).toEqual([])
    })

    it('want a path on the site', () => {
      for (const preview of ['https://example.com/{slug}', '//example.com/{slug}', 'blog/{slug}', '']) {
        expect(issues(schema(preview))).toEqual([
          { path, message: '"preview" of collection "post" has to be a path on the site, such as "/blog/{slug}"' },
        ])
      }

      expect(issues(schema(1))).toEqual([
        { path, message: '"preview" of collection "post" has to be a path, or an object with a path for each locale' },
      ])
      expect(issues(schema({ en: 1 }))).toEqual([
        { path, message: '"preview" of collection "post" has to be a path, or an object with a path for each locale' },
      ])
    })

    it('fill in only fields of the collection that hold one plain value', () => {
      expect(issues(schema('/{title}/{tags}/{body}'))).toEqual([
        { path, message: '"preview" of collection "post" uses "{title}", but the collection has no field "title"' },
        { path, message: '"preview" of collection "post" uses "{tags}", but only text, number and single list fields fit into an address' },
        { path, message: '"preview" of collection "post" uses "{body}", but only text, number and single list fields fit into an address' },
      ])
    })

    it('take a path for each locale the schema has, checked like a single one', () => {
      expect(issues(schema({ es: '{slug}', en: '/en{slug}' }, { locales: ['es', 'en'] }))).toEqual([])
      expect(issues(schema({ en: '/en/{body}', fr: '/fr{slug}' }, { locales: ['es', 'en'] }))).toEqual([
        { path: [...path, 'en'], message: '"preview" of collection "post" for en uses "{body}", but only text, number and single list fields fit into an address' },
        { path: [...path, 'fr'], message: '"preview" of collection "post" has no locale "fr"; the schema has es, en' },
      ])
      expect(issues(schema({ en: '/en{slug}' }, { locales: undefined }))).toEqual([
        { path, message: '"preview" of collection "post" has a path for each locale, but the schema has no locales' },
      ])
    })

    it('want locales before an address names one', () => {
      expect(issues(schema('/{locale}{slug}', { locales: undefined }))).toEqual([
        { path, message: '"preview" of collection "post" uses "{locale}", but the schema has no locales' },
      ])
    })

    it('belong to collections only', () => {
      expect(issues({ components: { card: { preview: '/{title}', fields: { title: { type: 'text' } } } }, collections: {} })).toEqual([
        { path: ['components', 'card', 'preview'], message: 'Component "card" has no option "preview"' },
      ])
    })
  })

  describe('single collections', () => {
    it('are collections with "single" switched on', () => {
      expect(issues({ collections: { settings: { single: true, fields: {} }, post: { single: false, fields: {} } } })).toEqual([])
      expect(issues({ collections: { settings: { single: 'yes', fields: {} } } })).toEqual([
        { path: ['collections', 'settings', 'single'], message: '"single" of collection "settings" has to be true or false' },
      ])
    })

    it('leave components out', () => {
      expect(issues({ components: { card: { single: true, fields: {} } }, collections: {} })).toEqual([
        { path: ['components', 'card', 'single'], message: 'Component "card" has no option "single"' },
      ])
    })

    it('can\'t be referenced, since the site queries them directly', () => {
      expect(issues({
        components: { card: { fields: { link: { type: 'collection', collections: ['settings'] } } } },
        collections: { settings: { single: true, fields: {} }, post: { fields: { settings: { type: 'collection', collections: ['post', 'settings'] } } } },
      })).toEqual([
        { path: ['components', 'card', 'fields', 'link', 'collections', 0], message: 'Field "card.link" references the single collection "settings"; query it directly instead' },
        { path: ['collections', 'post', 'fields', 'settings', 'collections', 1], message: 'Field "post.settings" references the single collection "settings"; query it directly instead' },
      ])
    })
  })
})
