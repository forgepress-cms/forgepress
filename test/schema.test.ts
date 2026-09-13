import { describe, expect, it } from 'vitest'
import { defineForgePressSchema } from '../src/config'

describe('defineForgePressSchema', () => {
  it('returns the schema unchanged', () => {
    const schema = defineForgePressSchema({
      collections: {
        hero: { fields: { headline: { type: 'text' } } },
      },
    })

    expect(schema.collections.hero.fields.headline.type).toBe('text')
  })

  it('narrows collection names and locales', () => {
    const schema = defineForgePressSchema({
      locales: ['en', 'de'],
      collections: {
        hero: { fields: { headline: { type: 'text', translate: true } } },
      },
    })

    const locale: 'en' | 'de' = schema.locales[0]

    expect(locale).toBe('en')
  })

  it('rejects a translated field when no locales are declared', () => {
    // @ts-expect-error translate: true requires at least one locale
    defineForgePressSchema({
      collections: {
        hero: { fields: { headline: { type: 'text', translate: true } } },
      },
    })
  })

  it('rejects a translated field when locales is empty', () => {
    defineForgePressSchema({
      // @ts-expect-error translate: true requires at least one locale
      locales: [],
      collections: {
        hero: { fields: { headline: { type: 'text', translate: true } } },
      },
    })
  })

  it('allows an untranslated field with no locales', () => {
    defineForgePressSchema({
      collections: {
        hero: { fields: { headline: { type: 'text' } } },
      },
    })
  })
})
