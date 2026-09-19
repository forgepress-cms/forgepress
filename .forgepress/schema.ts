import type { ForgePressSchema } from 'forgepress'

export default {
  collections: {
    page: {
      label: 'Page',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          description: 'The title of the page',
          translate: true,
        },
        slug: {
          type: 'text',
          label: 'Slug',
          description: 'The URL slug of the page',
          translate: true,
        },
        description: {
          type: 'text',
          label: 'Description',
          description: 'A short meta description of the page',
          optional: true,
          translate: true,
        },
        content: {
          type: 'dynamic',
          label: 'Content',
          description: 'The content of the page',
          collections: ['banner'],
        },
        showInMenu: {
          type: 'boolean',
          label: 'Show in menu',
          description: 'Whether the page is visible in the main page menu',
          default: true,
        },
        showInFooter: {
          type: 'boolean',
          label: 'Show in footer',
          description: 'Whether the page is shown in the footer menu',
        },
      },
    },
    banner: {
      label: 'Banner',
      fields: {
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The headline of the banner',
          optional: true,
          translate: true,
        },
        subheadline: {
          type: 'text',
          label: 'Subheadline',
          description: 'The subheadline of the banner',
          optional: true,
          translate: true,
        },
        image: {
          type: 'image',
          label: 'image',
          description: 'The banner image',
          multiple: true,
        },
      },
    },
  },
  locales: ['en', 'de'],
  defaultLocale: 'en',
} as const satisfies ForgePressSchema
