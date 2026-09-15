import { query } from 'forgepress'

export async function loadHome() {
  const [page, pages] = await Promise.all([
    query('page').where('slug', '/').first(),
    query('page').sort('slug', 'asc').pick('id', 'title', 'slug'),
  ])

  return { page: page ?? null, pages }
}

export type Home = Awaited<ReturnType<typeof loadHome>>
