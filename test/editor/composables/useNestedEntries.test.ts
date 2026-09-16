import type { Entry, EntryStatus } from '../../../src/entries/types'
import type { ForgePressSchema } from '../../../src/schema/types'
import { describe, expect, it, vi } from 'vitest'
import { SINGLE } from '../../../editor/utils/entry'

const schema = {
  collections: {
    hero: { fields: { headline: { type: 'text' } } },
    section: { fields: { title: { type: 'text' }, blocks: { type: 'dynamic', collections: ['hero', 'section'], optional: true } } },
  },
} as const satisfies ForgePressSchema

vi.doMock('../../../editor/composables/useContent', () => ({
  useContent: () => ({ store: { schema: async () => schema } }),
}))

const { useNestedEntries } = await import('../../../editor/composables/useNestedEntries')

function nested() {
  return useNestedEntries()
}

function stored(id: string, status: EntryStatus, fields: Record<string, unknown> = {}): Entry {
  return { id, status, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', ...fields }
}

describe('new blocks', () => {
  it('take the status of the entry they are saved with', async () => {
    const blocks = await nested()
    const id = blocks.create('hero', 'page_1')

    blocks.drafts[id]!.values.headline![SINGLE] = 'Welcome'

    expect(blocks.rows('published')).toEqual({ hero: [expect.objectContaining({ id, status: 'published', headline: 'Welcome' })] })
    expect(blocks.rows('unpublished').hero?.[0]?.status).toBe('unpublished')
  })

  it('take the status of the linked entry that holds them', async () => {
    const blocks = await nested()

    blocks.open('section', stored('section_1', 'published', { title: 'Shared' }))

    const inside = blocks.create('section', 'section_1')
    const deeper = blocks.create('hero', inside)

    expect(blocks.rows('unpublished')).toEqual({
      section: [expect.objectContaining({ id: inside, status: 'published' })],
      hero: [expect.objectContaining({ id: deeper, status: 'published' })],
    })
  })

  it('are still saved when the block that held them is removed', async () => {
    const blocks = await nested()
    const outer = blocks.create('section', 'page_1')
    const inner = blocks.create('hero', outer)

    blocks.discard(outer)

    expect(blocks.rows('published')).toEqual({ hero: [expect.objectContaining({ id: inner, status: 'published' })] })
  })
})

describe('linked blocks', () => {
  it('are saved only while they differ from the entry, with its own status', async () => {
    const blocks = await nested()

    blocks.open('hero', stored('hero_1', 'unpublished', { headline: 'Hello' }))

    expect(blocks.rows('published')).toEqual({})

    blocks.drafts.hero_1!.values.headline![SINGLE] = 'Hello again'

    expect(blocks.rows('published')).toEqual({ hero: [stored('hero_1', 'unpublished', { headline: 'Hello again' })] })

    blocks.drafts.hero_1!.values.headline![SINGLE] = 'Hello'

    expect(blocks.rows('published')).toEqual({})
  })

  it('keep their changes when the same entry is opened again', async () => {
    const blocks = await nested()

    blocks.open('hero', stored('hero_1', 'published', { headline: 'Hello' }))
    blocks.drafts.hero_1!.values.headline![SINGLE] = 'Edited'
    blocks.open('hero', stored('hero_1', 'published', { headline: 'Hello' }))

    expect(blocks.drafts.hero_1!.values.headline![SINGLE]).toBe('Edited')
  })

  it('leave an independent copy of their content when unlinked', async () => {
    const blocks = await nested()

    blocks.open('hero', stored('hero_1', 'published', { headline: 'Hello' }))
    blocks.drafts.hero_1!.values.headline![SINGLE] = 'Edited'

    const copy = blocks.copy('hero_1', 'page_1')

    blocks.drafts[copy]!.values.headline![SINGLE] = 'Edited copy'

    expect(blocks.drafts.hero_1!.values.headline![SINGLE]).toBe('Edited')

    blocks.discard('hero_1')

    expect(blocks.rows('unpublished')).toEqual({ hero: [expect.objectContaining({ id: copy, status: 'unpublished', headline: 'Edited copy' })] })
  })

  it('count as missing fields only once they changed', async () => {
    const blocks = await nested()

    blocks.open('section', stored('section_1', 'published'))
    blocks.create('hero', 'page_1')

    expect(blocks.missing()).toEqual(['headline of the new hero'])

    blocks.drafts.section_1!.values.blocks![SINGLE] = [{ collection: 'hero', id: 'hero_9' }]

    expect(blocks.missing()).toEqual(['title of section_1', 'headline of the new hero'])
  })
})
