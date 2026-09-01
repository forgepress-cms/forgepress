import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<'blogPost'>([
  {
    id: 'blogPost_5c2ab51974f7',
    status: 'published',
    title: {
      en: 'Jane\'s Blog Post',
      de: 'Janes Blogbeitrag',
    },
    author: 'author_b164750d6eba',
    content: {
      en: '# Jane\'s Blog Post\n\nThis is the content of Jane\'s blog post. It can include **markdown text** formatting, images, and other media elements.\n\nInline image!\n\n![teams-background.7661893b.png](/uploads/teams-background.7661893b.png)\n\n',
      de: '# Janes Blogbeitrag\n\nDies ist der Inhalt von Janes Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2026-09-01T15:50:33.022Z',
    coverImage: {
      url: '/uploads/teams-background.7661893b.png',
      width: 1920,
      height: 1080,
    },
  },
  {
    id: 'blogPost_2d868f6ec3df',
    status: 'published',
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
    createdAt: '2024-01-16T00:00:00Z',
    updatedAt: '2024-01-31T00:00:00Z',
  },
  {
    id: 'blogPost_b65b9cf77fca',
    status: 'published',
    title: {
      en: 'John\'s Blog Post',
      de: 'Johns Blogbeitrag',
    },
    author: 'author_0a44d95186b8',
    content: {
      en: '# John\'s Blog Post\n\nThis is the content of John\'s [blog](wa) post. It can include **markdown text** formatting, images, and other media elements.',
      de: '# Johns Blogbeitrag\n\nDies ist der Inhalt von Johns Blogbeitrag. Er kann **Markdown-Text**-Formatierung, Bilder und andere Medienelemente enthalten.',
    },
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2026-09-01T15:49:23.469Z',
  },
])
