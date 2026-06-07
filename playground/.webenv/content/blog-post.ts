import type { WebenvContent } from '../../../src/types/schema'
import type schema from '../schema'

export default [
  {
    title: 'Jane\'s Blog Post',
    author: { ids: ['jane-doe'] },
    content: '# Jane\'s Blog Post\n\nThis is the content of Jane\'s blog post. It can include **markdown text** formatting, images, and other media elements.',
  },
] satisfies WebenvContent<typeof schema, 'blogPost'>
