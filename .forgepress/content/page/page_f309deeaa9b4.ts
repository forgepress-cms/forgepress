import type { Content } from 'forgepress'

export default {
  id: 'page_f309deeaa9b4',
  status: 'published',
  createdAt: '2026-09-19T16:14:33.293Z',
  updatedAt: '2026-10-11T09:36:54.623Z',
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
  layout: 'landing',
  content: [
    {
      component: 'hero',
      headline: {
        en: 'Test headline Banner',
        de: 'Test headline Banner DE',
      },
      subheadline: {
        en: 'Test subheadline Banner',
        de: 'Test subheadline Banner',
      },
      media: {
        url: '/uploads/blueprint.dcf56475.png',
        alt: 'Blueprint',
        width: 2910,
        height: 1104,
      },
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
      component: 'prose',
      content: {
        en: 'Test text block',
        de: 'Test text block DE',
      },
    },
    {
      component: 'code',
      filename: 'test.js',
      language: 'js',
      source: 'import testFunction from \'test\'\n\nconst test2 = () => testFunction()\n\nconst test3 = () => console.log(test2())\n\ntest3()',
    },
  ],
} satisfies Content<'page'>
