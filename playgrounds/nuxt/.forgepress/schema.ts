import type { ForgePressSchema } from 'forgepress'

export default {
  locales: ['en', 'de'],
  collections: {
    author: {
      label: 'Author',
      description: 'Author information, including name, portrait, and biography',
      fields: {
        name: {
          type: 'text',
          label: 'Name',
          description: 'The name of the author',
        },
        portrait: {
          type: 'image',
          label: 'Portrait',
          description: 'A portrait of the author',
        },
        biography: {
          type: 'richtext',
          label: 'Biography',
          description: 'A short biography of the author',
          translate: true,
        },
        blogPosts: {
          type: 'relation',
          label: 'Blog Posts',
          description: 'The blog posts authored by this author',
          collection: 'blogPost',
          multiple: true,
        },
      },
    },
    blogPost: {
      label: 'Blog Post',
      description: 'Blog post information, including author, title, cover image, and content',
      fields: {
        author: {
          type: 'relation',
          label: 'Author',
          description: 'The author of this blog post',
          collection: 'author',
        },
        title: {
          type: 'text',
          label: 'Title',
          description: 'The title of the blog post',
          translate: true,
        },
        coverImage: {
          type: 'image',
          label: 'Cover Image',
          description: 'A cover image for the blog post',
          optional: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The content of the blog post',
          translate: true,
        },
      },
    },
    hero: {
      label: 'Hero',
      description: 'A hero section with a headline, subheadline, and background image',
      fields: {
        headline: {
          type: 'text',
          label: 'Headline',
          description: 'The main headline for the hero section',
          translate: true,
        },
        subheadline: {
          type: 'text',
          label: 'Subheadline',
          description: 'A subheadline for the hero section',
          translate: true,
        },
        backgroundImage: {
          type: 'image',
          label: 'Background Image',
          description: 'A background image for the hero section',
          multiple: true,
        },
      },
    },
    textBlock: {
      label: 'Text',
      description: 'A text element with content',
      fields: {
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The content of the text element',
          translate: true,
        },
      },
    },
    page: {
      label: 'Page',
      description: 'A generic page collection with a title and content',
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
          description: 'The URL slug for the page',
          translate: true,
        },
        content: {
          type: 'dynamic',
          label: 'Content',
          description: 'The content of the page, which can include various elements',
          collections: ['hero', 'textBlock'],
        },
      },
    },
  },
} as const satisfies ForgePressSchema
