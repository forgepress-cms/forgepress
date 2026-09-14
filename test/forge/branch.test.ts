import { afterEach, describe, expect, it, vi } from 'vitest'
import { createForgejoForge } from '../../src/forge/forgejo'
import { createGitHubForge } from '../../src/forge/github'
import { createGitLabForge } from '../../src/forge/gitlab'

function serve(routes: Record<string, unknown>): string[] {
  const requests: string[] = []

  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const request = `${init.method ?? 'GET'} ${url.pathname}${url.search}`

    requests.push(request)

    return routes[request] === undefined ? new Response('Not Found', { status: 404 }) : Response.json(routes[request])
  })

  return requests
}

const token = async (): Promise<string> => 'secret'

const change = [{ path: '.forgepress/content/author/a.ts', data: 'a', encoding: 'utf-8' as const }]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('default branch', () => {
  it('is looked up once on GitHub and kept for heads and commits', async () => {
    const repo = '/repos/acme/site'
    const requests = serve({
      'GET /user': { login: 'fred', name: null, avatar_url: '' },
      [`GET ${repo}`]: { default_branch: 'main', permissions: { push: true } },
      [`GET ${repo}/git/ref/heads/main`]: { object: { sha: 'c1' } },
      [`GET ${repo}/git/commits/c1`]: { tree: { sha: 't1' } },
      [`POST ${repo}/git/blobs`]: { sha: 'b1' },
      [`POST ${repo}/git/trees`]: { sha: 't2' },
      [`POST ${repo}/git/commits`]: { sha: 'c2' },
      [`PATCH ${repo}/git/refs/heads/main`]: { object: { sha: 'c2' } },
    })

    const signedIn = createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)

    expect((await signedIn.access()).branch).toBe('main')
    expect(await signedIn.head()).toBe('c1')
    expect(await signedIn.commit(change, 'content: a', 'c1')).toBe('c2')
    expect(requests.filter(request => request === `GET ${repo}`)).toHaveLength(1)

    const fresh = createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)

    await fresh.head()
    await fresh.commit(change, 'content: a', 'c1')

    expect(requests.filter(request => request === `GET ${repo}`)).toHaveLength(2)
  })

  it('is looked up once on GitLab and kept for heads and commits', async () => {
    const project = '/api/v4/projects/acme%2Fsite'
    const requests = serve({
      'GET /api/v4/user': { username: 'fred', name: null, avatar_url: null },
      [`GET ${project}`]: { default_branch: 'main', permissions: { project_access: { access_level: 40 } } },
      [`GET ${project}/repository/branches/main`]: { commit: { id: 'c1' } },
      [`POST ${project}/repository/commits`]: { id: 'c2' },
    })

    const signedIn = createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site' } }, token)

    expect((await signedIn.access()).branch).toBe('main')
    expect(await signedIn.head()).toBe('c1')
    expect(await signedIn.commit(change, 'content: a', 'c1')).toBe('c2')
    expect(requests.filter(request => request === `GET ${project}`)).toHaveLength(1)

    const fresh = createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site' } }, token)

    await fresh.head()
    await fresh.commit(change, 'content: a', 'c1')

    expect(requests.filter(request => request === `GET ${project}`)).toHaveLength(2)
  })

  it('is looked up once on Forgejo and kept for heads and commits', async () => {
    const repo = '/api/v1/repos/acme/site'
    const requests = serve({
      'GET /api/v1/user': { login: 'fred', full_name: null, avatar_url: null },
      [`GET ${repo}`]: { default_branch: 'main', permissions: { push: true } },
      [`GET ${repo}/branches/main`]: { commit: { id: 'c1' } },
      [`POST ${repo}/contents`]: { commit: { sha: 'c2' } },
    })

    const signedIn = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)

    expect((await signedIn.access()).branch).toBe('main')
    expect(await signedIn.head()).toBe('c1')
    expect(await signedIn.commit(change, 'content: a', 'c1')).toBe('c2')
    expect(requests.filter(request => request === `GET ${repo}`)).toHaveLength(1)

    const fresh = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)

    await fresh.head()
    await fresh.commit(change, 'content: a', 'c1')

    expect(requests.filter(request => request === `GET ${repo}`)).toHaveLength(2)
  })

  it('is looked up again after the lookup failed', async () => {
    const repo = '/api/v1/repos/acme/site'
    const failing = serve({ [`GET ${repo}/branches/main`]: { commit: { id: 'c1' } } })
    const forgejo = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)

    await expect(forgejo.head()).rejects.toThrow('Forgejo 404')

    const working = serve({ [`GET ${repo}`]: { default_branch: 'main' }, [`GET ${repo}/branches/main`]: { commit: { id: 'c1' } } })

    expect(await forgejo.head()).toBe('c1')
    expect(failing).toEqual([`GET ${repo}`])
    expect(working).toEqual([`GET ${repo}`, `GET ${repo}/branches/main`])
  })
})
