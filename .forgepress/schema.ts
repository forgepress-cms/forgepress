import type { ForgePressSchema } from 'forgepress'

export default {
  collections: {
    page: {
      label: 'Page',
      description: 'A page of the site, with a title and content',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          description: 'The title of the page',
        },
        slug: {
          type: 'text',
          label: 'Slug',
          description: 'The address of the page, such as / for the home page',
          index: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The content of the page',
        },
      },
    },
  },
  locales: ['en', 'de'],
  defaultLocale: 'en',
} as const satisfies ForgePressSchema
