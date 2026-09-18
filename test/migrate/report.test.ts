import type { Effect } from '../../src/migrate/types'
import { describe, expect, it } from 'vitest'
import { nearest, slugify } from '../../src/migrate/fill'
import { describeValue, groupEffects } from '../../src/migrate/report'

describe('effect groups', () => {
  it('groups effects by kind, collection, field and locale and counts entries', () => {
    const effects: Effect[] = [
      { kind: 'lost', collection: 'post', id: 'post_1', title: 'A', field: 'title', locale: 'de' },
      { kind: 'lost', collection: 'post', id: 'post_2', title: 'B', field: 'title', locale: 'de' },
      { kind: 'invalid', collection: 'post', id: 'post_1', title: 'A', field: 'score', message: 'x' },
      { kind: 'invalid', collection: 'post', id: 'post_1', title: 'A', field: 'score', message: 'y' },
    ]

    expect(groupEffects(effects, ['lost', 'invalid']).map(group => [group.kind, group.field, group.locales, group.effects.length, group.entries])).toEqual([
      ['lost', 'title', ['de'], 2, 2],
      ['invalid', 'score', [], 2, 1],
    ])

    expect(groupEffects(effects, ['invalid'], false)).toHaveLength(1)
  })

  it('describes values in a line', () => {
    expect(describeValue('Hello\nWorld')).toBe('Hello')
    expect(describeValue({ en: 'Hello', de: 'Hallo' })).toBe('en: Hello · de: Hallo')
    expect(describeValue([{ url: '/uploads/a.png' }, { collection: 'hero', id: 'hero_1' }])).toBe('/uploads/a.png, hero hero_1')
    expect(describeValue('x'.repeat(100))).toHaveLength(60)
    expect(describeValue(undefined)).toBe('—')
  })
})

describe('fills', () => {
  it('makes slugs', () => {
    expect(slugify('  Über die Brücke! ')).toBe('uber-die-brucke')
  })

  it('finds the nearest allowed number', () => {
    const field = { type: 'number', min: 1, max: 10, step: 2 } as const

    expect([0, 2, 2.9, 11, 10].map(value => nearest(value, field))).toEqual([1, 3, 3, 9, 9])
    expect(nearest(7.25, { type: 'number', step: 0.5 })).toBe(7.5)
    expect(nearest(-4, { type: 'number', min: 0 })).toBe(0)
  })
})
