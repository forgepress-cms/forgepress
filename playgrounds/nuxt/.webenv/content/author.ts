import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<'author'>([
  {
    id: 'author_b164750d6eba',
    status: 'published',
    name: 'Jane Doe',
    portrait: {
      url: 'https://example.com/jane-doe.jpg',
      alt: 'Portrait of Jane Doe',
    },
    biography: {
      en: 'Jane Doe is a software engineer and technical writer with over 10 years of experience in the industry. She has a passion for open source software and enjoys sharing her knowledge through writing and speaking engagements.',
      de: 'Jane Doe ist Software-Ingenieurin und technische Autorin mit uber 10 Jahren Branchenerfahrung. Sie hat eine Leidenschaft fur Open-Source-Software und teilt ihr Wissen gerne durch Artikel und Vortrage.',
    },
    blogPosts: ['blogPost_5c2ab51974f7', 'blogPost_2d868f6ec3df'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2026-09-01T10:39:37.523Z',
  },
  {
    id: 'author_0a44d95186b8',
    status: 'published',
    name: 'John Smith',
    portrait: {
      url: 'https://example.com/john-smith.jpg',
      alt: 'Portrait of John Smith',
    },
    biography: {
      en: 'John Smith is a product manager with a background in design and user experience. He has worked on a variety of products, from mobile apps to enterprise software, and is passionate about creating intuitive and user-friendly experiences.',
      de: 'John Smith ist Product Manager mit Hintergrund in Design und User Experience. Er hat an verschiedenen Produkten gearbeitet, von Mobile-Apps bis Unternehmenssoftware, und begeistert sich fur intuitive, benutzerfreundliche Erlebnisse.',
    },
    blogPosts: ['blogPost_b65b9cf77fca'],
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2026-09-01T10:42:42.801Z',
  },
])
