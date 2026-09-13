import { describe, expect, it } from 'vitest'
import { matchRoute } from '../src/editor/plugins/router'

const index = { name: 'index' }
const content = { name: 'content' }
const collection = { name: 'collection' }
const row = { name: 'row' }

const routes = {
  '': index,
  'content': content,
  'content/new': row,
  'content/:collection': collection,
  'content/:collection/:id': row,
}

describe('matchRoute', () => {
  it('matches static patterns', () => {
    expect(matchRoute(routes, '').page).toBe(index)
    expect(matchRoute(routes, 'content').page).toBe(content)
  })

  it('captures dynamic segments', () => {
    expect(matchRoute(routes, 'content/blogPost')).toMatchObject({ page: collection, params: { collection: 'blogPost' } })
    expect(matchRoute(routes, 'content/blogPost/blog-post-1')).toMatchObject({
      page: row,
      params: { collection: 'blogPost', id: 'blog-post-1' },
    })
  })

  it('prefers the pattern declared first', () => {
    expect(matchRoute(routes, 'content/new').page).toBe(row)
  })

  it('ignores empty segments', () => {
    expect(matchRoute(routes, 'content/').page).toBe(content)
    expect(matchRoute(routes, '/content//blogPost').params).toEqual({ collection: 'blogPost' })
  })

  it('decodes segments', () => {
    expect(matchRoute(routes, 'content/blog%20post').params).toEqual({ collection: 'blog post' })
  })

  it('falls back to the index route', () => {
    expect(matchRoute(routes, 'nope').page).toBe(index)
    expect(matchRoute(routes, 'content/a/b/c').page).toBe(index)
  })
})
