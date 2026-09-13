import { defineForgePressSchema } from '../../../../src/index'

export default defineForgePressSchema({
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
        author: { type: 'relation', label: 'Author', collection: 'author' },
      },
    },
  },
})
