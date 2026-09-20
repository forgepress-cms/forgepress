import type { ForgePressSchema } from '../../../../src/index'

export default {
  locales: ['en', 'de'],

  collections: {
    author: {
      label: 'Author',
      fields: {
        name: { type: 'text', label: 'Name' },
      },
    },

    blogPost: {
      label: 'Blog Post',
      fields: {
        title: { type: 'text', label: 'Title', translate: true },
        author: { type: 'collection', label: 'Author', collections: ['author'] },
      },
    },
  },
} as const satisfies ForgePressSchema
