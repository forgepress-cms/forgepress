import type { EditorContent } from '../src/editor/plugins/content'
import type { ForgePressSchema } from '../src/types/schema'
import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { useNestedEntries } from '../src/editor/composables/useNestedEntries'
import { contentKey } from '../src/editor/plugins/content'
import { SINGLE } from '../src/editor/utils/entry'

const schema = {
  collections: {
    hero: { fields: { headline: { type: 'text' } } },
  },
} as const satisfies ForgePressSchema

function nested() {
  const app = createApp({ render: () => null })

  app.provide(contentKey, { store: { schema: async () => schema } } as unknown as EditorContent)

  return app.runWithContext(() => useNestedEntries())
}

describe('new blocks', () => {
  it('take the status of the entry they are saved with', async () => {
    const blocks = await nested()
    const id = blocks.create('hero')

    blocks.drafts[id]!.values.headline![SINGLE] = 'Welcome'

    expect(blocks.rows('published')).toEqual({ hero: [expect.objectContaining({ id, status: 'published', headline: 'Welcome' })] })
    expect(blocks.rows('unpublished').hero?.[0]?.status).toBe('unpublished')
  })
})
