import type { ForgePressSchema } from '../../../src/schema/types'
import type { SchemaWriter } from '../../../src/store/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const schema: ForgePressSchema = { collections: { author: { fields: {} } } }
const calls: string[] = []

let writer: SchemaWriter | undefined

vi.doMock('../../../editor/composables/useContent', () => ({
  useContent: () => ({
    store: { schema: async () => schema },
    schemaWriter: async () => writer,
  }),
}))

const { useSchema } = await import('../../../editor/composables/useSchema')

beforeEach(() => {
  calls.length = 0
  writer = {
    writeSchema: async (next) => {
      calls.push(`schema with ${Object.keys(next.collections).length} collections`)
    },
    writeContent: async (collection) => {
      calls.push(`content of ${collection}`)
    },
    removeCollection: async (collection) => {
      calls.push(`remove ${collection}`)
    },
  }
})

describe('schema editing', () => {
  it('is refused outside development', async () => {
    writer = undefined

    await expect(useSchema()).rejects.toThrow('[forgepress] the schema can only be edited in development')
  })

  it('writes the content that goes with a change before the schema', async () => {
    const editor = await useSchema()

    const written = await editor.write((draft) => {
      delete draft.collections.author
    }, target => target.removeCollection('author'))

    expect(written).toBe(true)
    expect(calls).toEqual(['remove author', 'schema with 0 collections'])
    expect(editor.schema.value.collections).toEqual({})
    expect(schema.collections.author).toEqual({ fields: {} })
  })

  it('writes nothing when the change would not validate', async () => {
    const editor = await useSchema()

    const written = await editor.write((draft) => {
      draft.collections.Author = { fields: {} }
    }, target => target.writeContent('author', []))

    expect(written).toBe(false)
    expect(calls).toEqual([])
    expect(editor.error.value).toContain('Collection "Author"')
    expect(Object.keys(editor.schema.value.collections)).toEqual(['author'])
  })
})
