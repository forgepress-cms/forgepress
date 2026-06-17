import type schema from '../schema'

import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<typeof schema, 'blogPost'>([
  {
    id: 'blog-post-1',
    status: 'published',
    title: {
      de: 'Janes Blogbeitrag',
      en: 'Jane\'s Blog Post',
    },
    author: 'author-1',
    content: {
      de: '# Janes Blogbeitrag\n\nDies ist der Inhalt von Janes Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
      en: '# Jane\'s Blog Post\n\nThis is the content of Jane\'s blog post. It can include **markdown text** formatting, images, and other media elements.',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'blog-post-2',
    status: 'published',
    title: {
      de: 'Janes zweiter Blogbeitrag',
      en: 'Jane\'s Second Blog Post',
    },
    author: 'author-1',
    coverImage: {
      url: 'https://example.com/jane-second-blog-post-cover.jpg',
    },
    content: {
      de: '# Janes zweiter Blogbeitrag\n\nDies ist der Inhalt von Janes zweitem Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
      en: '# Jane\'s Second Blog Post\n\nThis is the content of Jane\'s second blog post. It can include **markdown text** formatting, images, and other media elements.',
    },
    createdAt: '2024-01-16T00:00:00Z',
    updatedAt: '2024-01-31T00:00:00Z',
  },
  {
    id: 'blog-post-3',
    status: 'published',
    title: {
      de: 'Johns Blogbeitrag',
      en: 'John\'s Blog Post',
    },
    author: 'author-2',
    content: {
      de: '# Johns Blogbeitrag\n\nDies ist der Inhalt von Johns Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
      en: '# John\'s Blog Post\n\nThis is the content of John\'s blog post. It can include **markdown text** formatting, images, and other media elements.',
    },
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
])
