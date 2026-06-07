import type { WebenvContent } from 'webenv'
import type schema from '../schema'

export default [
  {
    id: 'blog-post-1',
    title: 'Jane\'s Blog Post',
    author: { ids: ['author-1'] },
    content: '# Jane\'s Blog Post\n\nThis is the content of Jane\'s blog post. It can include **markdown text** formatting, images, and other media elements.',
  },
  {
    id: 'blog-post-2',
    title: 'Jane\'s Second Blog Post',
    author: { ids: ['author-1'] },
    content: '# Jane\'s Second Blog Post\n\nThis is the content of Jane\'s second blog post. It can include **markdown text** formatting, images, and other media elements.',
  },
  {
    id: 'blog-post-3',
    title: 'John\'s Blog Post',
    author: { ids: ['author-2'] },
    content: '# John\'s Blog Post\n\nThis is the content of John\'s blog post. It can include **markdown text** formatting, images, and other media elements.',
  },
] satisfies WebenvContent<typeof schema, 'blogPost'>
