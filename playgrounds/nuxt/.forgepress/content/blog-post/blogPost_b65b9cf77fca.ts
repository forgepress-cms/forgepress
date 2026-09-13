import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'blogPost_b65b9cf77fca',
  status: 'published',
  createdAt: '2024-02-01T00:00:00Z',
  updatedAt: '2026-09-01T15:49:23.469Z',
  title: {
    en: 'John\'s Blog Post',
    de: 'Johns Blogbeitrag',
  },
  author: 'author_0a44d95186b8',
  content: {
    en: '# John\'s Blog Post\n\nThis is the content of John\'s [blog](wa) post. It can include **markdown text** formatting, images, and other media elements.',
    de: '# Johns Blogbeitrag\n\nDies ist der Inhalt von Johns Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
  },
} satisfies ForgePressEntry<'blogPost'>
