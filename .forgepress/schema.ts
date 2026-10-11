import type { Schema } from 'forgepress'

export default {
  components: {
    prose: {
      label: 'Prose',
      fields: {
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The text of this block',
          translate: true,
        },
      },
    },
    callout: {
      label: 'Callout',
      fields: {
        kind: {
          type: 'list',
          label: 'Kind',
          description: 'How the callout is styled',
          values: ['note', 'tip', 'warning', 'caution'],
        },
        title: {
          type: 'text',
          label: 'Title',
          description: 'The heading of the callout',
          optional: true,
          translate: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The text of the callout',
          translate: true,
        },
      },
    },
    steps: {
      label: 'Steps',
      fields: {
        steps: {
          type: 'component',
          label: 'Steps',
          description: 'The steps to follow, in order',
          components: ['step'],
          multiple: true,
        },
      },
    },
    step: {
      label: 'Step',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          description: 'What this step does',
          translate: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The text of the step',
          translate: true,
        },
      },
    },
    accordion: {
      label: 'Accordion',
      fields: {
        panels: {
          type: 'component',
          label: 'Panels',
          description: 'The panels that open one at a time',
          components: ['panel'],
          multiple: true,
        },
      },
    },
    panel: {
      label: 'Panel',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          description: 'The heading that opens the panel',
          translate: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The text inside the panel',
          translate: true,
        },
      },
    },
    code: {
      label: 'Code',
      fields: {
        filename: {
          type: 'text',
          label: 'Filename',
          description: 'The file this belongs in, shown above the code',
          optional: true,
        },
        language: {
          type: 'list',
          label: 'Language',
          description: 'The language the code is highlighted as',
          values: ['ts', 'tsx', 'js', 'vue', 'html', 'css', 'json', 'sh', 'md'],
        },
        source: {
          type: 'text',
          label: 'Source',
          description: 'The code itself',
          multiline: true,
        },
      },
    },
    codeGroup: {
      label: 'Code Group',
      fields: {
        blocks: {
          type: 'component',
          label: 'Blocks',
          description: 'The code samples, shown as tabs',
          components: ['code'],
          multiple: true,
        },
      },
    },
    figure: {
      label: 'Figure',
      fields: {
        image: {
          type: 'image',
          label: 'Image',
          description: 'The image to show',
        },
        caption: {
          type: 'text',
          label: 'Caption',
          description: 'The text below the image',
          optional: true,
          translate: true,
        },
        wide: {
          type: 'boolean',
          label: 'Wide',
          description: 'Whether the image breaks out of the text column',
        },
      },
    },
    embed: {
      label: 'Embed',
      fields: {
        url: {
          type: 'text',
          label: 'URL',
          description: 'The address to embed, such as a video',
          validation: '^https?://',
        },
        title: {
          type: 'text',
          label: 'Title',
          description: 'What the embed shows',
          optional: true,
          translate: true,
        },
      },
    },
    hero: {
      label: 'Hero',
      fields: {
        eyebrow: {
          type: 'text',
          label: 'Eyebrow',
          description: 'The small line above the headline',
          optional: true,
          translate: true,
        },
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The headline of the hero',
          translate: true,
        },
        subheadline: {
          type: 'text',
          label: 'Subheadline',
          description: 'The line below the headline',
          optional: true,
          translate: true,
        },
        media: {
          type: 'image',
          label: 'Media',
          description: 'The image beside or below the text',
          optional: true,
        },
        links: {
          type: 'component',
          label: 'Links',
          description: 'The buttons of the hero',
          components: ['link'],
          multiple: true,
          optional: true,
        },
      },
    },
    cards: {
      label: 'Cards',
      fields: {
        cards: {
          type: 'component',
          label: 'Cards',
          description: 'The cards of this block',
          components: ['card'],
          multiple: true,
        },
      },
    },
    card: {
      label: 'Card',
      fields: {
        icon: {
          type: 'list',
          label: 'Icon',
          description: 'The icon of the card',
          values: ['lightning', 'house', 'user', 'arrow-left', 'arrow-right'],
        },
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
        link: {
          type: 'component',
          label: 'Link',
          description: 'Where the card leads',
          components: ['link'],
          optional: true,
        },
      },
    },
    features: {
      label: 'Features',
      fields: {
        features: {
          type: 'component',
          label: 'Features',
          description: 'The features, shown one below the other',
          components: ['feature'],
          multiple: true,
        },
      },
    },
    feature: {
      label: 'Feature',
      fields: {
        media: {
          type: 'image',
          label: 'Media',
          description: 'The image of the feature',
          optional: true,
        },
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The headline of the feature',
          translate: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The text of the feature',
          translate: true,
        },
        flipped: {
          type: 'boolean',
          label: 'Flipped',
          description: 'Whether the image sits on the other side',
        },
      },
    },
    logos: {
      label: 'Logos',
      fields: {
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The line above the logos',
          optional: true,
          translate: true,
        },
        images: {
          type: 'image',
          label: 'Images',
          description: 'The logos to show',
          multiple: true,
        },
      },
    },
    cta: {
      label: 'Call To Action',
      fields: {
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The headline of the call to action',
          translate: true,
        },
        content: {
          type: 'text',
          label: 'Content',
          description: 'The line below the headline',
          optional: true,
          translate: true,
        },
        links: {
          type: 'component',
          label: 'Links',
          description: 'The buttons of the call to action',
          components: ['link'],
          multiple: true,
        },
      },
    },
    table: {
      label: 'Table',
      fields: {
        caption: {
          type: 'text',
          label: 'Caption',
          description: 'What the table lists',
          optional: true,
          translate: true,
        },
        rows: {
          type: 'component',
          label: 'Rows',
          description: 'The rows of the table',
          components: ['row'],
          multiple: true,
        },
      },
    },
    row: {
      label: 'Row',
      fields: {
        name: {
          type: 'text',
          label: 'Name',
          description: 'The name of the option or field',
        },
        type: {
          type: 'text',
          label: 'Type',
          description: 'The type it takes',
          optional: true,
        },
        default: {
          type: 'text',
          label: 'Default',
          description: 'The value it falls back to',
          optional: true,
        },
        required: {
          type: 'boolean',
          label: 'Required',
          description: 'Whether it has to be set',
        },
        description: {
          type: 'richtext',
          label: 'Description',
          description: 'What it does',
          translate: true,
        },
      },
    },
    menuItem: {
      label: 'Menu Item',
      fields: {
        label: {
          type: 'text',
          label: 'Label',
          description: 'The text of the item, which falls back to the title of the page',
          optional: true,
          translate: true,
        },
        page: {
          type: 'collection',
          label: 'Page',
          description: 'The page this item leads to',
          collections: ['page'],
          optional: true,
        },
        url: {
          type: 'text',
          label: 'URL',
          description: 'An address outside the site, used when no page is picked',
          optional: true,
        },
        items: {
          type: 'component',
          label: 'Items',
          description: 'The items below this one',
          components: ['menuLink'],
          multiple: true,
          optional: true,
        },
      },
    },
    menuLink: {
      label: 'Menu Link',
      fields: {
        label: {
          type: 'text',
          label: 'Label',
          description: 'The text of the link, which falls back to the title of the page',
          optional: true,
          translate: true,
        },
        page: {
          type: 'collection',
          label: 'Page',
          description: 'The page this link leads to',
          collections: ['page'],
          optional: true,
        },
        url: {
          type: 'text',
          label: 'URL',
          description: 'An address outside the site, used when no page is picked',
          optional: true,
        },
      },
    },
    link: {
      label: 'Link',
      fields: {
        label: {
          type: 'text',
          label: 'Label',
          description: 'The text of the link',
          translate: true,
        },
        page: {
          type: 'collection',
          label: 'Page',
          description: 'The page this leads to',
          collections: ['page'],
          optional: true,
        },
        url: {
          type: 'text',
          label: 'URL',
          description: 'An address outside the site, used when no page is picked',
          optional: true,
        },
        variant: {
          type: 'list',
          label: 'Variant',
          description: 'How the link is styled',
          values: ['primary', 'secondary', 'ghost'],
        },
      },
    },
  },
  collections: {
    menu: {
      label: 'Menu',
      description: 'An ordered set of pages, such as the header, the footer or the documentation sidebar',
      fields: {
        name: {
          type: 'text',
          label: 'Name',
          description: 'How the site asks for this menu, such as main, footer or docs',
          validation: '^[a-z][a-z0-9-]*$',
          index: true,
        },
        items: {
          type: 'component',
          label: 'Items',
          description: 'The items of the menu, in the order they are shown',
          components: ['menuItem'],
          multiple: true,
        },
      },
    },
    page: {
      label: 'Page',
      description: 'Every page of the site, from the home page to a page of the documentation',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          description: 'The title of the page',
          translate: true,
          index: true,
        },
        slug: {
          type: 'text',
          label: 'Slug',
          description: 'The address of the page, such as / or /docs/schema',
          translate: true,
          index: true,
        },
        layout: {
          type: 'list',
          label: 'Layout',
          description: 'Which chrome the page renders with',
          values: ['landing', 'doc', 'plain'],
          index: true,
        },
        description: {
          type: 'text',
          label: 'Description',
          description: 'A short meta description of the page',
          optional: true,
          translate: true,
        },
        badge: {
          type: 'list',
          label: 'Badge',
          description: 'A label shown next to the page in the navigation',
          values: ['new', 'updated', 'experimental'],
          optional: true,
        },
        ogImage: {
          type: 'image',
          label: 'Social image',
          description: 'The image shown when the page is shared',
          optional: true,
        },
        content: {
          type: 'component',
          label: 'Content',
          description: 'The content elements of the page',
          components: [
            'hero',
            'prose',
            'code',
            'codeGroup',
            'callout',
            'steps',
            'accordion',
            'cards',
            'features',
            'logos',
            'table',
            'figure',
            'embed',
            'cta',
          ],
          multiple: true,
        },
      },
    },
  },
  locales: ['en', 'de'],
  defaultLocale: 'en',
} as const satisfies Schema
