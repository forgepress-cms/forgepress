import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'page_f309deeaa9b4',
  status: 'published',
  createdAt: '2026-09-19T16:14:33.293Z',
  updatedAt: '2026-09-20T12:35:46.313Z',
  title: {
    en: 'Test',
    de: 'Test',
  },
  slug: {
    en: '/test',
    de: '/test',
  },
  description: {
    en: 'Test description',
    de: 'Test Beschreibung!',
  },
  showInMenu: true,
  showInFooter: false,
  content: [
    {
      component: 'banner',
      headline: {
        en: 'Test headline Banner',
        de: 'Test headline Banner DE',
      },
      subheadline: {
        en: 'Test subheadline Banner',
        de: 'Test subheadline Banner',
      },
      media: [
        {
          url: '/uploads/blueprint.dcf56475.png',
          alt: 'Blueprint',
          width: 2910,
          height: 1104,
        },
      ],
    },
    {
      component: 'cards',
      cards: [
        {
          headline: {
            en: 'Test',
            de: 'Test',
          },
          subheadline: {
            en: 'Test subheadline',
            de: 'Test Unterüberschrift',
          },
          icon: 'house',
        },
      ],
    },
    {
      component: 'textBlock',
      content: {
        en: 'Test text block',
        de: 'Test text block DE',
      },
    },
  ],
} satisfies ForgePressEntry<'page'>
