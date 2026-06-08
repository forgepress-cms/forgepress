import type schema from '../schema'

import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<typeof schema, 'author'>([
  {
    id: 'author-1',
    status: 'published',
    name: 'jane-doe',
    portrait: {
      url: 'https://example.com/jane-doe.jpg',
      alt: 'Portrait of Jane Doe',
    },
    biography: {
      de: 'Jane Doe ist Software-Ingenieurin und technische Autorin mit uber 10 Jahren Branchenerfahrung. Sie hat eine Leidenschaft fur Open-Source-Software und teilt ihr Wissen gerne durch Artikel und Vortrage.',
      en: 'Jane Doe is a software engineer and technical writer with over 10 years of experience in the industry. She has a passion for open source software and enjoys sharing her knowledge through writing and speaking engagements.',
    },
    blogPosts: ['blog-post-1', 'blog-post-2'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'author-2',
    status: 'published',
    name: 'john-smith',
    portrait: {
      url: 'https://example.com/john-smith.jpg',
      alt: 'Portrait of John Smith',
    },
    biography: {
      de: 'John Smith ist Product Manager mit Hintergrund in Design und User Experience. Er hat an verschiedenen Produkten gearbeitet, von Mobile-Apps bis Unternehmenssoftware, und begeistert sich fur intuitive, benutzerfreundliche Erlebnisse.',
      en: 'John Smith is a product manager with a background in design and user experience. He has worked on a variety of products, from mobile apps to enterprise software, and is passionate about creating intuitive and user-friendly experiences.',
    },
    blogPosts: ['blog-post-3'],
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
])
