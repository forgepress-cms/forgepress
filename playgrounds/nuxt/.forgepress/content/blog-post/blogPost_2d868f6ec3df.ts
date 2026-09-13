import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'blogPost_2d868f6ec3df',
  status: 'published',
  createdAt: '2024-01-16T00:00:00Z',
  updatedAt: '2024-01-31T00:00:00Z',
  title: {
    de: 'Janes zweiter Blogbeitrag',
    en: 'Jane\'s Second Blog Post',
  },
  author: 'author_b164750d6eba',
  coverImage: {
    url: 'https://example.com/jane-second-blog-post-cover.jpg',
  },
  content: {
    de: '# Janes zweiter Blogbeitrag\n\nDies ist der Inhalt von Janes zweitem Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
    en: '# Jane\'s Second Blog Post\n\nThis is the content of Jane\'s second blog post. It can include **markdown text** formatting, images, and other media elements.',
  },
} satisfies ForgePressEntry<'blogPost'>
