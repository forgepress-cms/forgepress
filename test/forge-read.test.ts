import { afterEach, describe, expect, it, vi } from 'vitest'
import { textToBase64 } from '../src/forge'
import { createForgejoForge } from '../src/forge/forgejo'
import { createGitHubForge } from '../src/forge/github'
import { createGitLabForge } from '../src/forge/gitlab'

type Handler = () => Response

interface Request {
  url: string
  headers: Record<string, string>
}

function serve(routes: Record<string, unknown>): Request[] {
  const requests: Request[] = []

  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const key = `${url.pathname}${url.search}`
    const route = routes[key]

    requests.push({ url: key, headers: init.headers as Record<string, string> })

    if (route === undefined)
      return new Response('Not Found', { status: 404 })

    if (typeof route === 'function')
      return (route as Handler)()

    return typeof route === 'string' ? new Response(route) : Response.json(route)
  })

  return requests
}

function tree(entries: [path: string, type: string, sha: string][]) {
  return entries.map(([path, type, sha]) => ({ path, type, sha }))
}

const token = async (): Promise<string> => 'secret'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reading from GitHub', () => {
  const github = () => createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)

  it('resolves the head of the default branch', async () => {
    serve({
      '/repos/acme/site': { default_branch: 'main' },
      '/repos/acme/site/git/ref/heads/main': { object: { sha: 'c1' } },
    })

    expect(await github().head()).toBe('c1')
  })

  it('walks down to a folder and lists every file below it', async () => {
    const requests = serve({
      '/repos/acme/site/git/trees/c1': { truncated: false, tree: tree([['apps', 'tree', 't-apps'], ['README.md', 'blob', 'b-readme']]) },
      '/repos/acme/site/git/trees/t-apps': { truncated: false, tree: tree([['.forgepress', 'tree', 't-content']]) },
      '/repos/acme/site/git/trees/t-content?recursive=1': {
        truncated: false,
        tree: tree([['schema.ts', 'blob', 'b-schema'], ['content', 'tree', 't-entries'], ['content/author/a.ts', 'blob', 'b-a']]),
      },
    })

    expect(await github().files('c1', 'apps/.forgepress')).toEqual([
      { path: 'apps/.forgepress/schema.ts', sha: 'b-schema' },
      { path: 'apps/.forgepress/content/author/a.ts', sha: 'b-a' },
    ])
    expect(requests.every(request => request.headers.authorization === 'Bearer secret')).toBe(true)
  })

  it('lists nothing when the folder does not exist', async () => {
    serve({ '/repos/acme/site/git/trees/c1': { truncated: false, tree: tree([['.forgepress', 'blob', 'b-file']]) } })

    expect(await github().files('c1', '.forgepress')).toEqual([])
  })

  it('refuses a listing GitHub cut short', async () => {
    serve({
      '/repos/acme/site/git/trees/c1': { truncated: false, tree: tree([['.forgepress', 'tree', 't-content']]) },
      '/repos/acme/site/git/trees/t-content?recursive=1': { truncated: true, tree: [] },
    })

    await expect(github().files('c1', '.forgepress')).rejects.toThrow('GitHub lists too many files in .forgepress')
  })

  it('reads a file as raw text', async () => {
    const requests = serve({ '/repos/acme/site/git/blobs/b-a': 'export default {}\n' })

    expect(await github().read('b-a')).toBe('export default {}\n')
    expect(requests[0]?.headers.accept).toBe('application/vnd.github.raw+json')
  })
})

describe('reading from GitLab', () => {
  const gitlab = () => createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site', branch: 'content' } }, token)
  const project = '/api/v4/projects/acme%2Fsite'

  it('resolves the head of the configured branch', async () => {
    serve({ [`${project}/repository/branches/content`]: { commit: { id: 'c1' } } })

    expect(await gitlab().head()).toBe('c1')
  })

  it('follows every page of the listing', async () => {
    serve({
      [`${project}/repository/tree?path=apps%2F.forgepress&ref=c1&recursive=true&per_page=100&pagination=keyset`]: () => Response.json(
        [{ id: 'b-schema', type: 'blob', path: 'apps/.forgepress/schema.ts' }, { id: 't-content', type: 'tree', path: 'apps/.forgepress/content' }],
        { headers: { link: `<https://gitlab.com${project}/repository/tree?page_token=next&pagination=keyset>; rel="next", <https://gitlab.com${project}/repository/tree>; rel="first"` } },
      ),
      [`${project}/repository/tree?page_token=next&pagination=keyset`]: [{ id: 'b-a', type: 'blob', path: 'apps/.forgepress/content/author/a.ts' }],
    })

    expect(await gitlab().files('c1', 'apps/.forgepress')).toEqual([
      { path: 'apps/.forgepress/schema.ts', sha: 'b-schema' },
      { path: 'apps/.forgepress/content/author/a.ts', sha: 'b-a' },
    ])
  })

  it('lists nothing when the folder does not exist', async () => {
    serve({})

    expect(await gitlab().files('c1', '.forgepress')).toEqual([])
  })

  it('reads a file as raw text', async () => {
    serve({ [`${project}/repository/blobs/b-a/raw`]: 'export default {}\n' })

    expect(await gitlab().read('b-a')).toBe('export default {}\n')
  })
})

describe('reading from Forgejo', () => {
  const forgejo = () => createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)
  const repo = '/api/v1/repos/acme/site'

  it('resolves the head of the default branch', async () => {
    serve({
      [repo]: { default_branch: 'main' },
      [`${repo}/branches/main`]: { commit: { id: 'c1' } },
    })

    expect(await forgejo().head()).toBe('c1')
  })

  it('walks down to a folder and follows every page of the listing', async () => {
    serve({
      [`${repo}/git/trees/c1?recursive=false&per_page=1000&page=1`]: { total_count: 1, tree: tree([['.forgepress', 'tree', 't-content']]) },
      [`${repo}/git/trees/t-content?recursive=true&per_page=1000&page=1`]: { total_count: 3, tree: tree([['schema.ts', 'blob', 'b-schema'], ['content', 'tree', 't-entries']]) },
      [`${repo}/git/trees/t-content?recursive=true&per_page=1000&page=2`]: { total_count: 3, tree: tree([['content/author/a.ts', 'blob', 'b-a']]) },
    })

    expect(await forgejo().files('c1', '.forgepress')).toEqual([
      { path: '.forgepress/schema.ts', sha: 'b-schema' },
      { path: '.forgepress/content/author/a.ts', sha: 'b-a' },
    ])
  })

  it('lists nothing when the folder does not exist', async () => {
    serve({ [`${repo}/git/trees/c1?recursive=false&per_page=1000&page=1`]: { total_count: 0, tree: [] } })

    expect(await forgejo().files('c1', '.forgepress')).toEqual([])
  })

  it('decodes a file as UTF-8 text', async () => {
    serve({ [`${repo}/git/blobs/b-a`]: { content: textToBase64('name: \'Grüße 👋\'\n'), encoding: 'base64' } })

    expect(await forgejo().read('b-a')).toBe('name: \'Grüße 👋\'\n')
  })
})
