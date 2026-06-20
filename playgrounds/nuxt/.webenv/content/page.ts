import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<'page'>([
  {
    id: 'page-1',
    status: 'published',
    slug: {
      de: '/',
      en: '/',
    },
    title: {
      de: 'Startseite',
      en: 'Home',
    },
    content: [
      {
        type: 'hero',
        component: 'hero-1',
      },
      {
        type: 'textBlock',
        component: 'textBlock-1',
      },
      {
        type: 'textBlock',
        component: 'textBlock-2',
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
])
