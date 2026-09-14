import { afterEach, describe, expect, it, vi } from 'vitest'
import { createForgejoForge } from '../../src/forge/forgejo'
import { createGitHubForge } from '../../src/forge/github'
import { createGitLabForge } from '../../src/forge/gitlab'
import { textToBase64 } from '../../src/utils/encoding'

interface Request {
  method: string
  url: string
  body?: unknown
}

function serve(routes: Record<string, unknown>): Request[] {
  const requests: Request[] = []

  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const method = init.method ?? 'GET'
    const route = routes[`${method} ${url.pathname}${url.search}`]

    requests.push({ method, url: `${url.pathname}${url.search}`, ...typeof init.body === 'string' ? { body: JSON.parse(init.body) } : {} })

    return route === undefined ? new Response('Not Found', { status: 404 }) : Response.json(route)
  })

  return requests
}

function sent(requests: Request[], method: string, url: string): unknown {
  return requests.find(request => request.method === method && request.url === url)?.body
}

const token = async (): Promise<string> => 'secret'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('committing to GitHub', () => {
  it('builds the commit on the parent it was given', async () => {
    const repo = '/repos/acme/site'
    const requests = serve({
      [`GET ${repo}`]: { default_branch: 'main' },
      [`GET ${repo}/git/commits/c1`]: { tree: { sha: 't1' } },
      [`POST ${repo}/git/blobs`]: { sha: 'b-new' },
      [`POST ${repo}/git/trees`]: { sha: 't2' },
      [`POST ${repo}/git/commits`]: { sha: 'c2' },
      [`PATCH ${repo}/git/refs/heads/main`]: { object: { sha: 'c2' } },
    })

    const github = createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)
    const commit = await github.commit([
      { path: '.forgepress/content/author/a.ts', data: 'export default {}\n', encoding: 'utf-8', replaces: 'b-old' },
      { path: '.forgepress/content/author/b.ts', removed: true, replaces: 'b-gone' },
    ], 'content: authors', 'c1')

    expect(commit).toBe('c2')
    expect(sent(requests, 'POST', `${repo}/git/blobs`)).toEqual({ content: 'export default {}\n', encoding: 'utf-8' })
    expect(sent(requests, 'POST', `${repo}/git/trees`)).toEqual({
      base_tree: 't1',
      tree: [
        { path: '.forgepress/content/author/a.ts', mode: '100644', type: 'blob', sha: 'b-new' },
        { path: '.forgepress/content/author/b.ts', mode: '100644', type: 'blob', sha: null },
      ],
    })
    expect(sent(requests, 'POST', `${repo}/git/commits`)).toEqual({ message: 'content: authors', tree: 't2', parents: ['c1'] })
    expect(sent(requests, 'PATCH', `${repo}/git/refs/heads/main`)).toEqual({ sha: 'c2', force: false })
  })
})

describe('committing to GitLab', () => {
  it('names the last commit of each file as of the parent', async () => {
    const project = '/api/v4/projects/acme%2Fsite'
    const requests = serve({
      [`GET ${project}/repository/files/.forgepress%2Fcontent%2Fauthor%2Fa.ts?ref=c1`]: { last_commit_id: 'c0' },
      [`POST ${project}/repository/commits`]: { id: 'c2' },
    })

    const gitlab = createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site', branch: 'content' } }, token)
    const commit = await gitlab.commit([
      { path: '.forgepress/content/author/a.ts', data: 'a', encoding: 'utf-8', replaces: 'b-old' },
      { path: '.forgepress/content/author/b.ts', data: 'b', encoding: 'utf-8', replaces: null },
    ], 'content: authors', 'c1')

    expect(commit).toBe('c2')
    expect(sent(requests, 'POST', `${project}/repository/commits`)).toEqual({
      branch: 'content',
      commit_message: 'content: authors',
      actions: [
        { action: 'update', file_path: '.forgepress/content/author/a.ts', content: 'a', encoding: 'text', last_commit_id: 'c0' },
        { action: 'create', file_path: '.forgepress/content/author/b.ts', content: 'b', encoding: 'text' },
      ],
    })
  })
})

describe('committing to Forgejo', () => {
  it('names the hash of each file as of the parent', async () => {
    const repo = '/api/v1/repos/acme/site'
    const requests = serve({
      [`GET ${repo}`]: { default_branch: 'main' },
      [`GET ${repo}/contents/.forgepress/content/author/a.ts?ref=c1`]: { sha: 'b-old' },
      [`POST ${repo}/contents`]: { commit: { sha: 'c2' } },
    })

    const forgejo = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)
    const commit = await forgejo.commit([
      { path: '.forgepress/content/author/a.ts', data: 'a', encoding: 'utf-8', replaces: 'b-old' },
      { path: '.forgepress/content/author/b.ts', removed: true },
    ], 'content: authors', 'c1')

    expect(commit).toBe('c2')
    expect(sent(requests, 'POST', `${repo}/contents`)).toEqual({
      branch: 'main',
      message: 'content: authors',
      files: [{ operation: 'update', path: '.forgepress/content/author/a.ts', content: textToBase64('a'), sha: 'b-old' }],
    })
  })
})
