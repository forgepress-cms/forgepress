import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'blogPost_5c2ab51974f7',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2026-09-01T15:50:33.022Z',
  title: {
    en: 'Jane\'s Blog Post',
    de: 'Janes Blogbeitrag',
  },
  author: 'author_b164750d6eba',
  content: {
    en: '# Jane\'s Blog Post\n\nThis is the content of Jane\'s blog post. It can include **markdown text** formatting, images, and other media elements.\n\nInline image!\n\n![teams-background.7661893b.png](/uploads/teams-background.7661893b.png)\n\n',
    de: '# Janes Blogbeitrag\n\nDies ist der Inhalt von Janes Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
  },
  coverImage: {
    url: '/uploads/teams-background.7661893b.png',
    width: 1920,
    height: 1080,
  },
} satisfies ForgePressEntry<'blogPost'>
