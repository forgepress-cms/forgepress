import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<'textBlock'>([
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
])
