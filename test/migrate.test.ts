import type { Field } from '../src/fields'
import type { ContentRow } from '../src/types/content/reader'
import { describe, expect, it } from 'vitest'
import { migrate } from '../src/content/migrate'

const locales = ['en', 'de']

const hero = { url: '/uploads/hero.png', width: 1920, height: 1080 }
const banner = { url: '/uploads/banner.png' }

function rows(...values: unknown[]): ContentRow[] {
  return values.map((value, index) => ({
    id: `hero_${index}`,
    status: 'published' as const,
    createdAt: '',
    updatedAt: '',
    ...value === undefined ? {} : { cover: value },
  }))
}

function run(before: Field, after: Field, ...values: unknown[]) {
  return migrate(rows(...values), 'cover', before, after, locales)
}

const image = { type: 'image', optional: true } as Field
const images = { type: 'image', multiple: true, optional: true } as Field

describe('multiplicity', () => {
  it('wraps a single value when a field becomes multiple', () => {
    const { rows: [row], changed } = run(image, images, hero)

    expect(row!.cover).toEqual([hero])
    expect(changed).toBe(1)
  })

  it('keeps the first value when a field stops being multiple', () => {
    const { rows: [row], lost } = run(images, image, [hero, banner])

    expect(row!.cover).toEqual(hero)
    expect(lost).toBe(1)
  })

  it('loses nothing when the list holds one value', () => {
    const { rows: [row], lost } = run(images, image, [hero])

    expect(row!.cover).toEqual(hero)
    expect(lost).toBe(0)
  })

  it('leaves an empty field empty', () => {
    const { rows: [row], changed } = run(image, images, undefined)

    expect(row).not.toHaveProperty('cover')
    expect(changed).toBe(0)
  })

  it('keeps the field where it sits in the row', () => {
    const { rows: [row] } = run(image, images, hero)

    expect(Object.keys(row!)).toEqual(['id', 'status', 'createdAt', 'updatedAt', 'cover'])
  })
})

describe('relations', () => {
  const one = { type: 'relation', collection: 'author', optional: true } as Field
  const list = { type: 'relation', collection: 'author', multiple: true, optional: true } as Field
  const other = { type: 'relation', collection: 'tag', optional: true } as Field

  it('wraps and unwraps ids', () => {
    expect(run(one, list, 'author_a').rows[0]!.cover).toEqual(['author_a'])
    expect(run(list, one, ['author_a', 'author_b']).rows[0]!.cover).toBe('author_a')
  })

  it('drops ids that point at another collection', () => {
    const { rows: [row], lost } = run(one, other, 'author_a')

    expect(row).not.toHaveProperty('cover')
    expect(lost).toBe(1)
  })
})

describe('types', () => {
  const text = { type: 'text', optional: true } as Field
  const richtext = { type: 'richtext', optional: true } as Field
  const number = { type: 'number', optional: true } as Field
  const video = { type: 'video', optional: true } as Field

  it('keeps text through a richtext change', () => {
    expect(run(text, richtext, 'Hello').rows[0]!.cover).toBe('Hello')
  })

  it('reads a number out of text and back', () => {
    expect(run(text, number, '42').rows[0]!.cover).toBe(42)
    expect(run(number, text, 42).rows[0]!.cover).toBe('42')
  })

  it('drops text that is not a number', () => {
    expect(run(text, number, 'many').rows[0]).not.toHaveProperty('cover')
  })

  it('keeps media across image and video', () => {
    expect(run(image, video, hero).rows[0]!.cover).toEqual(hero)
  })

  it('drops a value the new type cannot hold', () => {
    expect(run(image, text, hero).rows[0]).not.toHaveProperty('cover')
  })
})

describe('dynamic', () => {
  const wide = { type: 'dynamic', collections: ['hero', 'textBlock'], optional: true } as Field
  const narrow = { type: 'dynamic', collections: ['hero'], optional: true } as Field

  it('drops blocks whose collection is no longer allowed', () => {
    const blocks = [{ collection: 'hero', id: 'hero_1' }, { collection: 'textBlock', id: 'textBlock_1' }]
    const { rows: [row], lost } = run(wide, narrow, blocks)

    expect(row!.cover).toEqual([blocks[0]])
    expect(lost).toBe(1)
  })
})

describe('translation', () => {
  const plain = { type: 'text', optional: true } as Field
  const translated = { type: 'text', translate: true, optional: true } as Field

  it('moves a plain value onto the first locale', () => {
    expect(run(plain, translated, 'Hello').rows[0]!.cover).toEqual({ en: 'Hello' })
  })

  it('keeps the first locale when translation is turned off', () => {
    const { rows: [row], lost } = run(translated, plain, { en: 'Hello', de: 'Hallo' })

    expect(row!.cover).toBe('Hello')
    expect(lost).toBe(1)
  })

  it('falls back to another locale when the first is empty', () => {
    expect(run(translated, plain, { de: 'Hallo' }).rows[0]!.cover).toBe('Hallo')
  })

  it('migrates every locale in place', () => {
    const before = { type: 'text', translate: true, optional: true } as Field
    const after = { type: 'number', translate: true, optional: true } as Field

    expect(run(before, after, { en: '1', de: '2' }).rows[0]!.cover).toEqual({ en: 1, de: 2 })
  })
})

describe('required fields', () => {
  const optional = { type: 'text', optional: true } as Field
  const required = { type: 'text' } as Field
  const requiredEverywhere = { type: 'text', translate: true } as Field

  it('counts entries that would have no value', () => {
    expect(run(optional, required, 'Hello', undefined).missing).toBe(1)
  })

  it('counts entries that would miss a locale', () => {
    expect(run(optional, requiredEverywhere, 'Hello').missing).toBe(1)
  })

  it('is happy when every locale is there', () => {
    const before = { type: 'text', translate: true, optional: true } as Field

    expect(run(before, requiredEverywhere, { en: 'Hello', de: 'Hallo' }).missing).toBe(0)
  })

  it('ignores empty values while the field stays optional', () => {
    expect(run(optional, optional, undefined).missing).toBe(0)
  })
})
