import { describe, expect, it } from 'vitest'
import { matchRoute } from '../src/editor/plugins/router'

const index = { name: 'index' }
const content = { name: 'content' }
const component = { name: 'component' }
const row = { name: 'row' }

const routes = {
  '': index,
  'content': content,
  'content/new': row,
  'content/:component': component,
  'content/:component/:id': row,
}

describe('matchRoute', () => {
  it('matches static patterns', () => {
    expect(matchRoute(routes, '').page).toBe(index)
    expect(matchRoute(routes, 'content').page).toBe(content)
  })

  it('captures dynamic segments', () => {
    expect(matchRoute(routes, 'content/blogPost')).toMatchObject({ page: component, params: { component: 'blogPost' } })
    expect(matchRoute(routes, 'content/blogPost/blog-post-1')).toMatchObject({
      page: row,
      params: { component: 'blogPost', id: 'blog-post-1' },
    })
  })

  it('prefers the pattern declared first', () => {
    expect(matchRoute(routes, 'content/new').page).toBe(row)
  })

  it('ignores empty segments', () => {
    expect(matchRoute(routes, 'content/').page).toBe(content)
    expect(matchRoute(routes, '/content//blogPost').params).toEqual({ component: 'blogPost' })
  })

  it('decodes segments', () => {
    expect(matchRoute(routes, 'content/blog%20post').params).toEqual({ component: 'blog post' })
  })

  it('falls back to the index route', () => {
    expect(matchRoute(routes, 'nope').page).toBe(index)
    expect(matchRoute(routes, 'content/a/b/c').page).toBe(index)
  })
})
