import { afterEach, describe, expect, it, vi } from 'vitest'
import { sent, serve } from '../../../test/fetch'
import { createGitLabForge } from './gitlab'

const token = async (): Promise<string> => 'secret'

afterEach(() => {
  vi.unstubAllGlobals()
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

describe('committing to GitLab', () => {
  it('names the last commit of each file as of the parent', async () => {
    const project = '/api/v4/projects/acme%2Fsite'
    const requests = serve({
      [`${project}/repository/files/.forgepress%2Fcontent%2Fauthor%2Fa.ts?ref=c1`]: { last_commit_id: 'c0' },
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

describe('default branch', () => {
  const change = [{ path: '.forgepress/content/author/a.ts', data: 'a', encoding: 'utf-8' as const }]

  it('is looked up once on GitLab and kept for heads and commits', async () => {
    const project = '/api/v4/projects/acme%2Fsite'
    const requests = serve({
      '/api/v4/user': { username: 'fred', name: null, avatar_url: null },
      [project]: { default_branch: 'main', permissions: { project_access: { access_level: 40 } } },
      [`${project}/repository/branches/main`]: { commit: { id: 'c1' } },
      [`POST ${project}/repository/commits`]: { id: 'c2' },
    })

    const signedIn = createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site' } }, token)

    expect((await signedIn.access()).branch).toBe('main')
    expect(await signedIn.head()).toBe('c1')
    expect(await signedIn.commit(change, 'content: a', 'c1')).toBe('c2')
    expect(requests.filter(request => request.url === project)).toHaveLength(1)

    const fresh = createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site' } }, token)

    await fresh.head()
    await fresh.commit(change, 'content: a', 'c1')

    expect(requests.filter(request => request.url === project)).toHaveLength(2)
  })
})

describe('checks on GitLab', () => {
  const gitlab = () => createGitLabForge({ type: 'gitlab', repository: { owner: 'acme', name: 'site' } }, token)
  const project = '/api/v4/projects/acme%2Fsite'

  it('reads the pipelines of the commit, except scheduled ones', async () => {
    serve({
      [`${project}/pipelines?sha=c1&per_page=100`]: [
        { id: 11, iid: 7, name: null, status: 'running', source: 'push', web_url: 'https://gitlab.com/acme/site/-/pipelines/11' },
        { id: 12, iid: 8, name: 'Nightly', status: 'failed', source: 'schedule', web_url: 'https://gitlab.com/acme/site/-/pipelines/12' },
        { id: 13, iid: 9, name: 'netlify', status: 'success', source: 'external', web_url: 'https://gitlab.com/acme/site/-/pipelines/13' },
        { id: 14, iid: 10, name: 'Deploy', status: 'failed', source: 'web', web_url: 'https://gitlab.com/acme/site/-/pipelines/14' },
        { id: 15, iid: 11, name: 'Manual', status: 'manual', source: 'push', web_url: 'https://gitlab.com/acme/site/-/pipelines/15' },
      ],
    })

    expect(await gitlab().checks('c1')).toEqual([
      { name: 'Pipeline #7', state: 'pending', url: 'https://gitlab.com/acme/site/-/pipelines/11' },
      { name: 'netlify', state: 'success', url: 'https://gitlab.com/acme/site/-/pipelines/13' },
      { name: 'Deploy', state: 'failure', url: 'https://gitlab.com/acme/site/-/pipelines/14' },
      { name: 'Manual', state: 'skipped', url: 'https://gitlab.com/acme/site/-/pipelines/15' },
    ])
  })

  it('knows whether a commit contains another from their merge base', async () => {
    const requests = serve({
      [`${project}/repository/merge_base?refs%5B%5D=c3&refs%5B%5D=c1`]: { id: 'c1' },
      [`${project}/repository/merge_base?refs%5B%5D=c0&refs%5B%5D=c1`]: { id: 'c0' },
    })
    const forge = gitlab()

    expect(await forge.contains('c3', 'c1')).toBe(true)
    expect(await forge.contains('c0', 'c1')).toBe(false)
    expect(await forge.contains('c1', 'c1')).toBe(true)
    expect(requests).toHaveLength(2)
  })
})
