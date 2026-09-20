import type { Entry } from '../../../src/entries/types'
import type { ForgePressSchema } from '../../../src/schema/types'
import type { MigrationState, SchemaChangeset, SchemaStore } from '../../../src/store/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { settle } from '../../settle'

const schema: ForgePressSchema = { collections: { author: { fields: { name: { type: 'text' } } } } }

const applied: SchemaChangeset[] = []

let content: Record<string, Entry[]> = {}
let state: MigrationState = {}
let store: SchemaStore | undefined

vi.doMock('../../../editor/composables/useContent', () => ({
  useContent: () => ({
    store: { schema: async () => schema },
    schemaStore: async () => store,
  }),
}))

const { questionKey, REMOVE, useSchema } = await import('../../../editor/composables/useSchema')

function author(id: string, fields: Record<string, unknown>): Entry {
  return { id, status: 'published', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...fields }
}

beforeEach(() => {
  applied.length = 0
  content = { author: [author('author_1', { name: 'Ada' })] }
  state = {}
  store = {
    content: async () => structuredClone(content),
    issues: async () => [],
    state: async () => state,
    apply: async (changeset) => {
      applied.push(changeset)
    },
    dismiss: async () => {
      state = {}
    },
  }
})

describe('schema editing', () => {
  it('is refused outside development', async () => {
    store = undefined

    await expect(useSchema()).rejects.toThrow('[forgepress] the schema can only be edited in development')
  })

  it('saves a change that loses nothing right away', async () => {
    const editor = await useSchema()

    const written = await editor.change((draft) => {
      draft.collections.author = { fields: { title: { type: 'text' } } }
    }, { fields: { author: { name: 'title' } } })

    expect(written).toBe(true)
    expect(editor.review.value).toBeUndefined()
    expect(applied).toHaveLength(1)
    expect(applied[0]).toMatchObject({ collections: [], write: [{ collection: 'author', entry: { id: 'author_1', title: 'Ada' } }] })
    expect(editor.schema.value.collections.author!.fields).toEqual({ title: { type: 'text' } })
    expect(schema.collections.author!.fields).toEqual({ name: { type: 'text' } })
  })

  it('saves a change that holds reactive values from the form', async () => {
    const editor = await useSchema()
    const values = reactive(['draft', 'final'])

    const written = await editor.change((draft) => {
      draft.collections.author!.fields.stage = { type: 'list', values, optional: true }
    })

    expect(written).toBe(true)
    expect(editor.schema.value.collections.author!.fields.stage).toEqual({ type: 'list', values: ['draft', 'final'], optional: true })
  })

  it('asks before a change removes content, and saves only once confirmed', async () => {
    const editor = await useSchema()

    const pending = editor.change((draft) => {
      delete draft.collections.author
    })

    await settle()

    const review = editor.review.value!

    expect(review.migration.value.effects).toMatchObject([{ kind: 'removed', collection: 'author', id: 'author_1' }])
    expect(applied).toEqual([])

    await review.apply()

    expect(await pending).toBe(true)
    expect(applied[0]).toMatchObject({ collections: ['author'], write: [] })
    expect(editor.review.value).toBeUndefined()
    expect(editor.schema.value.collections).toEqual({})
  })

  it('keeps everything when the review is cancelled', async () => {
    const editor = await useSchema()

    const pending = editor.change((draft) => {
      draft.collections.author!.fields = {}
    })

    await settle()
    editor.review.value!.cancel()

    expect(await pending).toBe(false)
    expect(applied).toEqual([])
    expect(editor.schema.value).toEqual(schema)
  })

  it('writes nothing when the change would not validate', async () => {
    const editor = await useSchema()

    const written = await editor.change((draft) => {
      draft.collections.Author = { fields: {} }
    })

    expect(written).toBe(false)
    expect(applied).toEqual([])
    expect(editor.error.value).toContain('Collection "Author"')
    expect(Object.keys(editor.schema.value.collections)).toEqual(['author'])
  })

  it('finds content that does not fit and repairs it with the answers given', async () => {
    content = { author: [author('author_1', { fullName: 'Ada' })] }
    state = { outstanding: { collections: { author: { fields: { fullName: { type: 'text' } } } } } }

    const editor = await useSchema()

    expect(await editor.mismatch()).toBe(1)

    const pending = editor.repair()

    await settle()

    const review = editor.review.value!
    const [question] = review.questions.value

    expect(question).toEqual({ kind: 'field', collection: 'author', from: 'fullName', to: ['name'] })
    expect(review.ready.value).toBe(false)

    review.choices.answers[questionKey(question!)] = 'name'
    await review.apply()

    expect(await pending).toBe(true)
    expect(applied[0]!.write).toMatchObject([{ collection: 'author', entry: { id: 'author_1', name: 'Ada' } }])
  })

  it('drops what a question says was removed', async () => {
    content = { author: [author('author_1', { name: 'Ada', fullName: 'Ada Lovelace' })] }

    const editor = await useSchema()
    const pending = editor.repair()

    await settle()

    const review = editor.review.value!

    expect(review.questions.value).toEqual([])
    expect(review.migration.value.effects).toMatchObject([{ kind: 'lost', field: 'fullName' }])

    review.choices.answers.unused = REMOVE
    await review.apply()

    expect(await pending).toBe(true)
    expect(applied[0]!.write[0]!.entry).toEqual(author('author_1', { name: 'Ada' }))
  })

  it('forgets a schema changed by hand when all content still fits', async () => {
    state = { outstanding: { collections: {} } }

    const editor = await useSchema()

    expect(await editor.mismatch()).toBe(0)
    expect(editor.state.value).toEqual({})
  })
})
