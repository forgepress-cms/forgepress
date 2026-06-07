import type { WebenvSchema } from 'webenv'

export default {
  components: {
    author: {
      label: 'Author',
      description: 'Author information, including name, portrait, and biography',
      elements: {
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
        },
        blogPosts: {
          type: 'relation',
          label: 'Blog Posts',
          description: 'The blog posts authored by this author',
          relation: {
            component: 'blogPost',
            multiple: true,
          },
        },
      },
    },

    blogPost: {
      label: 'Blog Post',
      description: 'Blog post information, including author, title, cover image, and content',
      elements: {
        author: {
          type: 'relation',
          label: 'Author',
          description: 'The author of this blog post',
          relation: {
            component: 'author',
          },
        },
        title: {
          type: 'text',
          label: 'Title',
          description: 'The title of the blog post',
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
        },
      },
    },
  },
} satisfies WebenvSchema
