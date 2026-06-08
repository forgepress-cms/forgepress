import type { WebenvContent } from 'webenv'
import type schema from '../schema'

export default [
  {
    id: 'hero-1',
    status: 'published',
    headline: {
      de: 'Willkommen auf unserer Website',
      en: 'Welcome to our website',
    },
    subheadline: {
      de: 'Wir freuen uns, dass Sie hier sind',
      en: 'We\'re glad you\'re here',
    },
    backgroundImage: {
      url: 'https://example.com/hero-background.jpg',
      alt: 'Hero background image',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
] satisfies WebenvContent<typeof schema, 'hero'>
