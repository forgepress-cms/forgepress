import type { ForgePressSchema } from 'forgepress'

export default {
  components: {
    cards: {
      label: 'Cards',
      fields: {
        cards: {
          type: 'component',
          label: 'Cards',
          description: 'The cards content',
          components: ['card'],
          multiple: true,
        },
      },
    },
    card: {
      label: 'Card',
      fields: {
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The card headline',
          translate: true,
        },
        subheadline: {
          type: 'text',
          label: 'Subheadline',
          description: 'The card subheadline',
          optional: true,
          translate: true,
        },
        icon: {
          type: 'list',
          label: 'Icon',
          description: 'The card icon',
          values: ['lightning', 'house', 'user', 'arrow-left', 'arrow-right'],
        },
      },
    },
    banner: {
      label: 'Banner',
      fields: {
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The banner headline',
          translate: true,
        },
        subheadline: {
          type: 'text',
          label: 'Subheadline',
          description: 'The banner subheadline',
          translate: true,
        },
        media: {
          type: 'image',
          label: 'Media',
          description: 'The banner media',
          multiple: true,
        },
      },
    },
    textBlock: {
      label: 'Text Block',
      fields: {
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The text box content',
          translate: true,
        },
      },
    },
  },
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
          type: 'component',
          label: 'Content',
          description: 'The page content',
          components: ['cards', 'banner', 'textBlock'],
          multiple: true,
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
  },
  locales: ['en', 'de'],
  defaultLocale: 'en',
} as const satisfies ForgePressSchema
