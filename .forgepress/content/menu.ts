import type { Content } from 'forgepress'

export default {
  id: 'menu',
  status: 'published',
  createdAt: '2026-09-20T18:10:00.000Z',
  updatedAt: '2026-11-20T17:52:05.323Z',
  name: 'main',
  items: [
    {
      label: {
        en: 'Test',
      },
      page: 'page_f309deeaa9b4',
    },
    {
      label: {
        en: 'Documentation',
        de: 'Dokumentation',
      },
      items: [
        {
          page: 'page_f309deeaa9b4',
        },
      ],
    },
    {
      label: {
        en: 'GitHub',
        de: 'GitHub',
      },
      url: 'https://github.com/forgepress-cms/forgepress',
    },
  ],
} satisfies Content<'menu'>
