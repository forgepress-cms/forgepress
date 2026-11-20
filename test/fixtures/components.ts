import type { Entry } from '../../src/entries/types'
import type { Schema } from '../../src/schema/types'

export const componentSchema = {
  locales: ['en', 'de'],
  components: {
    card: {
      fields: {
        title: { type: 'text' },
        author: { type: 'collection', collections: ['author'], optional: true },
        wide: { type: 'boolean' },
      },
    },
    grid: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
    quote: { fields: { saying: { type: 'text' } } },
    note: { fields: { text: { type: 'text', translate: true }, link: { type: 'collection', collections: ['author'], translate: true, optional: true } } },
  },
  collections: {
    page: {
      fields: {
        cards: { type: 'component', components: ['card'], multiple: true, translate: true, optional: true },
        grid: { type: 'component', components: ['grid'], optional: true },
        mixed: { type: 'component', components: ['card', 'quote'], multiple: true, optional: true },
        notes: { type: 'component', components: ['note'], multiple: true, optional: true },
      },
    },
    author: { fields: {} },
  },
} as const satisfies Schema

export function page(fields: Record<string, unknown>): Entry {
  return { id: 'page_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', ...fields }
}
