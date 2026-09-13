import type { ForgePressEntry } from '../../../../../../src/index'

export default {
  id: 'blog-post-1',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  title: { en: 'Hello', de: 'Hallo' },
  author: 'author-1',
} satisfies ForgePressEntry<'blogPost'>
