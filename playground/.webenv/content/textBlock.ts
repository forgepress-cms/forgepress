import type { WebenvContent } from 'webenv'
import type schema from '../schema'

export default [
  {
    id: 'textBlock-1',
    status: 'published',
    content: {
      de: 'Dies ist ein Textblock, der als Beispiel dient.',
      en: 'This is a text block that serves as an example.',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'textBlock-2',
    status: 'published',
    content: {
      de: 'Dies ist ein weiterer Textblock, der als Beispiel dient.',
      en: 'This is another text block that serves as an example.',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
] satisfies WebenvContent<typeof schema, 'textBlock'>
