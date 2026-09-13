import type { FormField } from '../src/editor/utils/schema'
import type { Field } from '../src/schema/fields'
import { describe, expect, it } from 'vitest'
import { entryLabel, fieldLocale, fromValues, missingFields, newEntry, SINGLE, titleField, toValues } from '../src/editor/utils/entry'

const locales = ['en', 'de']

function field(key: string, translated: boolean, extra: Partial<FormField> = {}): FormField {
  const type = extra.type ?? 'text'

  return {
    key,
    label: key,
    description: '',
    type,
    typeLabel: type,
    icon: 'i-lucide-type',
    config: { type } as Field,
    translated,
    optional: false,
    ...extra,
  }
}

const name = field('name', false)
const title = field('title', true)

describe('fieldLocale', () => {
  it('keeps untranslated fields on the single bucket', () => {
    expect(fieldLocale(name, locales)).toBe(SINGLE)
  })

  it('starts translated fields on the first locale', () => {
    expect(fieldLocale(title, locales)).toBe('en')
  })
})

describe('entry values', () => {
  const row = { id: 'author-1', status: 'unpublished' as const, createdAt: '', updatedAt: '', name: 'Jane', title: { en: 'Hello' } }

  it('reads a value under the bucket its input binds to', () => {
    const values = toValues([name, title], row, locales)

    expect(values.name![fieldLocale(name, locales)]).toBe('Jane')
    expect(values.title![fieldLocale(title, locales)]).toBe('Hello')
  })

  it('writes back what was edited', () => {
    const values = toValues([name, title], row, locales)

    values.name![fieldLocale(name, locales)] = 'John'
    values.title![fieldLocale(title, locales)] = 'Hi'

    expect(fromValues(name, values)).toBe('John')
    expect(fromValues(title, values)).toEqual({ en: 'Hi' })
  })

  it('drops fields left empty', () => {
    const values = toValues([name], { ...row, name: '' }, locales)

    expect(fromValues(name, values)).toBeUndefined()
  })
})

describe('missingFields', () => {
  const row = { id: 'author-1', status: 'unpublished' as const, createdAt: '', updatedAt: '' }

  it('reports a required field left empty', () => {
    const values = toValues([name], row, locales)

    expect(missingFields([name], values).map(field => field.key)).toEqual(['name'])
  })

  it('accepts a required field once filled', () => {
    const values = toValues([name], { ...row, name: 'Jane' }, locales)

    expect(missingFields([name], values)).toEqual([])
  })

  it('wants every locale of a required translated field', () => {
    const values = toValues([title], { ...row, title: { en: 'Hello' } }, locales)

    expect(missingFields([title], values).map(field => field.key)).toEqual(['title'])

    values.title!.de = 'Hallo'

    expect(missingFields([title], values)).toEqual([])
  })

  it('ignores optional fields', () => {
    const optional = field('note', false, { optional: true })
    const values = toValues([optional], row, locales)

    expect(missingFields([optional], values)).toEqual([])
  })

  it('wants a required media field to hold an asset', () => {
    const portrait = field('portrait', false, { type: 'image', config: { type: 'image' } as Field })

    expect(missingFields([portrait], toValues([portrait], row, locales)).map(field => field.key)).toEqual(['portrait'])
    expect(missingFields([portrait], toValues([portrait], { ...row, portrait: { url: 'a.png' } }, locales))).toEqual([])
  })
})

describe('newEntry', () => {
  it('identifies an entry without knowing the others', () => {
    const entry = newEntry('author')

    expect(entry.id).toMatch(/^author_[0-9a-f]{12}$/)
    expect(entry.status).toBe('unpublished')
    expect(newEntry('author').id).not.toBe(entry.id)
  })
})

describe('titleField', () => {
  const rich = field('content', true, { type: 'richtext' })

  it('names an entry by its first text field', () => {
    expect(titleField([rich, name])?.key).toBe('name')
  })

  it('falls back to richtext when there is no plain text field', () => {
    expect(titleField([rich])?.key).toBe('content')
  })

  it('has no name to use when there is no text field', () => {
    expect(titleField([field('portrait', false, { type: 'image' })])).toBeUndefined()
  })
})

describe('entryLabel', () => {
  const row = { id: 'author_abc', status: 'unpublished' as const, createdAt: '', updatedAt: '' }

  it('reads the first meaningful line of a body', () => {
    const rich = field('content', false, { type: 'richtext' })

    expect(entryLabel({ ...row, content: '# Jane\'s Post\n\nThe body.' }, rich)).toBe('Jane\'s Post')
  })

  it('reads through markdown syntax', () => {
    const rich = field('content', false, { type: 'richtext' })

    expect(entryLabel({ ...row, content: '## **Jane** on *design*' }, rich)).toBe('Jane on design')
  })

  it('shortens a long line', () => {
    const rich = field('content', false, { type: 'richtext' })

    expect(entryLabel({ ...row, content: 'a'.repeat(200) }, rich)).toBe(`${'a'.repeat(80)}…`)
  })

  it('falls back to the id when there is nothing to show', () => {
    expect(entryLabel(row, name)).toBe('author_abc')
    expect(entryLabel(row, undefined)).toBe('author_abc')
  })
})
