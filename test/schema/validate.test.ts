import { describe, expect, it } from 'vitest'
import { validateSchema } from '../../src/schema/validate'

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
            posts: { type: 'relation', collection: 'blogPost2', multiple: true },
          },
        },
        blogPost2: {
          fields: {
            author: { type: 'relation', collection: 'author', index: true },
            blocks: { type: 'dynamic', collections: ['author', 'blogPost2'] },
            empty: { type: 'dynamic', collections: [] },
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
      { path: ['collections', 'post', 'fields', 'field', 'type'], message: 'Field "post.field" has unknown type "colour"; use one of text, richtext, number, boolean, image, video, relation, dynamic' },
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

  it('indexes only text, number, boolean and relation fields', () => {
    for (const type of ['richtext', 'image', 'video']) {
      expect(issues(withField({ type, index: true }))).toEqual([
        { path: ['collections', 'post', 'fields', 'field', 'index'], message: 'Field "post.field" can\'t be indexed; only text, number, boolean and relation fields can' },
      ])
    }

    expect(issues(withField({ type: 'dynamic', collections: [], index: true }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'index'], message: 'Field "post.field" can\'t be indexed; only text, number, boolean and relation fields can' },
    ])

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

    expect(issues(withField({ type: 'dynamic', collections: 'author' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collections'], message: '"collections" of field "post.field" has to be a list of collection names' },
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
    expect(issues(withField({ type: 'relation' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field'], message: 'Field "post.field" needs "collection"' },
    ])

    expect(issues(withField({ type: 'dynamic' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field'], message: 'Field "post.field" needs "collections"' },
    ])
  })

  it('wants references to point at collections in the schema', () => {
    expect(issues(withField({ type: 'relation', collection: 'autor' }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collection'], message: 'Field "post.field" references unknown collection "autor"' },
    ])

    expect(issues(withField({ type: 'dynamic', collections: ['author', 'hero', 'author'] }))).toEqual([
      { path: ['collections', 'post', 'fields', 'field', 'collections', 1], message: 'Field "post.field" references unknown collection "hero"' },
      { path: ['collections', 'post', 'fields', 'field', 'collections', 2], message: 'Field "post.field" lists collection "author" twice' },
    ])
  })

  it('lets a collection reference itself', () => {
    expect(issues(withField({ type: 'relation', collection: 'post' }))).toEqual([])
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
        'bad-name': { fields: { link: { type: 'relation', collection: 'nowhere' } } },
      },
    })).toHaveLength(4)
  })
})
