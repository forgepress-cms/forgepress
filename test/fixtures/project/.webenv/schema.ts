import { defineWebenvSchema } from '../../../../src/index'

export default defineWebenvSchema({
  locales: ['en', 'de'],

  components: {
    author: {
      label: 'Author',
      elements: {
        name: { type: 'text', label: 'Name' },
      },
    },

    blogPost: {
      label: 'Blog Post',
      elements: {
        title: { type: 'text', label: 'Title', translate: true },
        author: { type: 'relation', label: 'Author', component: 'author' },
      },
    },
  },
})
