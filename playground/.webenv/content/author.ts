import type { WebenvContent } from '../../../src/types/schema'
import type schema from '../schema'

export default [
  {
    name: 'jane-doe',
    portrait: {
      url: 'https://example.com/jane-doe.jpg',
      alt: 'Portrait of Jane Doe',
    },
    biography: 'Jane Doe is a software engineer and technical writer with over 10 years of experience in the industry. She has a passion for open source software and enjoys sharing her knowledge through writing and speaking engagements.',
    blogPosts: {
      ids: ['janes-blog-post', 'janes-second-blog-post'],
    },
  },
  {
    name: 'john-smith',
    portrait: {
      url: 'https://example.com/john-smith.jpg',
      alt: 'Portrait of John Smith',
    },
    biography: 'John Smith is a product manager with a background in design and user experience. He has worked on a variety of products, from mobile apps to enterprise software, and is passionate about creating intuitive and user-friendly experiences.',
    blogPosts: {
      ids: ['johns-blog-post'],
    },
  },
] satisfies WebenvContent<typeof schema, 'author'>
