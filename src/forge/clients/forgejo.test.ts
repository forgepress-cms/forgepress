import { afterEach, describe, expect, it, vi } from 'vitest'
import { sent, serve } from '../../../test/fetch'
import { textToBase64 } from '../../utils/encoding'
import { createForgejoForge } from './forgejo'

function tree(entries: [path: string, type: string, sha: string][]) {
  return entries.map(([path, type, sha]) => ({ path, type, sha }))
}

const token = async (): Promise<string> => 'secret'

afterEach(() => {
  vi.unstubAllGlobals()
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

describe('committing to Forgejo', () => {
  it('names the hash of each file as of the parent', async () => {
    const repo = '/api/v1/repos/acme/site'
    const requests = serve({
      [repo]: { default_branch: 'main' },
      [`${repo}/contents/.forgepress/content/author/a.ts?ref=c1`]: { sha: 'b-old' },
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

describe('default branch', () => {
  const change = [{ path: '.forgepress/content/author/a.ts', data: 'a', encoding: 'utf-8' as const }]

  it('is looked up once on Forgejo and kept for heads and commits', async () => {
    const repo = '/api/v1/repos/acme/site'
    const requests = serve({
      '/api/v1/user': { login: 'fred', full_name: null, avatar_url: null },
      [repo]: { default_branch: 'main', permissions: { push: true } },
      [`${repo}/branches/main`]: { commit: { id: 'c1' } },
      [`POST ${repo}/contents`]: { commit: { sha: 'c2' } },
    })

    const signedIn = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)

    expect((await signedIn.access()).branch).toBe('main')
    expect(await signedIn.head()).toBe('c1')
    expect(await signedIn.commit(change, 'content: a', 'c1')).toBe('c2')
    expect(requests.filter(request => request.url === repo)).toHaveLength(1)

    const fresh = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)

    await fresh.head()
    await fresh.commit(change, 'content: a', 'c1')

    expect(requests.filter(request => request.url === repo)).toHaveLength(2)
  })

  it('is looked up again after the lookup failed', async () => {
    const repo = '/api/v1/repos/acme/site'
    const failing = serve({ [`${repo}/branches/main`]: { commit: { id: 'c1' } } })
    const forgejo = createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)

    await expect(forgejo.head()).rejects.toThrow('Forgejo 404')

    const working = serve({ [repo]: { default_branch: 'main' }, [`${repo}/branches/main`]: { commit: { id: 'c1' } } })

    expect(await forgejo.head()).toBe('c1')
    expect(failing.map(request => request.url)).toEqual([repo])
    expect(working.map(request => request.url)).toEqual([repo, `${repo}/branches/main`])
  })
})

describe('checks on Forgejo', () => {
  const forgejo = () => createForgejoForge({ type: 'forgejo', repository: { owner: 'acme', name: 'site' } }, token)
  const repo = '/api/v1/repos/acme/site'

  it('reads the commit statuses, resolves their links and leaves out scheduled runs', async () => {
    serve({
      [`${repo}/commits/c1/status?limit=50`]: {
        state: 'failure',
        statuses: [
          { status: 'pending', context: 'build / site (push)', target_url: '/acme/site/actions/runs/3/jobs/0' },
          { status: 'failure', context: 'links / check (schedule)', target_url: '/acme/site/actions/runs/2/jobs/0' },
          { status: 'error', context: 'ci/woodpecker/push/deploy', target_url: 'https://ci.acme.com/repos/1/pipeline/4' },
          { status: 'warning', context: 'size', target_url: '' },
          { status: 'success', context: 'pages', target_url: null },
        ],
      },
    })

    expect(await forgejo().checks('c1')).toEqual([
      { name: 'build / site (push)', state: 'pending', url: 'https://codeberg.org/acme/site/actions/runs/3/jobs/0' },
      { name: 'ci/woodpecker/push/deploy', state: 'failure', url: 'https://ci.acme.com/repos/1/pipeline/4' },
      { name: 'size', state: 'skipped' },
      { name: 'pages', state: 'success' },
    ])
  })

  it('reads no checks when nothing reported', async () => {
    serve({ [`${repo}/commits/c1/status?limit=50`]: { state: '', statuses: null } })

    expect(await forgejo().checks('c1')).toEqual([])
  })

  it('knows whether a commit contains another from the commits only the other has', async () => {
    const requests = serve({
      [`${repo}/compare/c3...c1`]: { total_commits: 0, commits: [], files: [] },
      [`${repo}/compare/c0...c1`]: { total_commits: 1, commits: [{ sha: 'c1' }], files: [] },
    })
    const forge = forgejo()

    expect(await forge.contains('c3', 'c1')).toBe(true)
    expect(await forge.contains('c0', 'c1')).toBe(false)
    expect(await forge.contains('c1', 'c1')).toBe(true)
    expect(requests).toHaveLength(2)
  })
})
