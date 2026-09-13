import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'author_b164750d6eba',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2026-09-01T16:11:35.317Z',
  name: 'Jane Doe',
  portrait: {
    url: '/uploads/teams-background.7661893b.png',
    width: 1920,
    height: 1080,
  },
  biography: {
    en: 'Jane Doe is a software engineer and technical writer with over 10 years of experience in the industry. She has a passion for open source software and enjoys sharing her knowledge through writing and speaking engagements.',
    de: 'Jane Doe ist Software-Ingenieurin und technische Autorin mit uber 10 Jahren Branchenerfahrung. Sie hat eine Leidenschaft fur Open-Source-Software und teilt ihr Wissen gerne durch Artikel und Vortrage.',
  },
  blogPosts: ['blogPost_5c2ab51974f7', 'blogPost_2d868f6ec3df'],
} satisfies ForgePressEntry<'author'>
