import { afterEach, describe, expect, it, vi } from 'vitest'
import { sent, serve } from '../../../test/fetch'
import { createGitHubForge } from './github'

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

describe('committing to GitHub', () => {
  it('builds the commit on the parent it was given', async () => {
    const repo = '/repos/acme/site'
    const requests = serve({
      [repo]: { default_branch: 'main' },
      [`${repo}/git/commits/c1`]: { tree: { sha: 't1' } },
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

describe('default branch', () => {
  const change = [{ path: '.forgepress/content/author/a.ts', data: 'a', encoding: 'utf-8' as const }]

  it('is looked up once on GitHub and kept for heads and commits', async () => {
    const repo = '/repos/acme/site'
    const requests = serve({
      '/user': { login: 'fred', name: null, avatar_url: '' },
      [repo]: { default_branch: 'main', permissions: { push: true } },
      [`${repo}/git/ref/heads/main`]: { object: { sha: 'c1' } },
      [`${repo}/git/commits/c1`]: { tree: { sha: 't1' } },
      [`POST ${repo}/git/blobs`]: { sha: 'b1' },
      [`POST ${repo}/git/trees`]: { sha: 't2' },
      [`POST ${repo}/git/commits`]: { sha: 'c2' },
      [`PATCH ${repo}/git/refs/heads/main`]: { object: { sha: 'c2' } },
    })

    const signedIn = createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)

    expect((await signedIn.access()).branch).toBe('main')
    expect(await signedIn.head()).toBe('c1')
    expect(await signedIn.commit(change, 'content: a', 'c1')).toBe('c2')
    expect(requests.filter(request => request.url === repo)).toHaveLength(1)

    const fresh = createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)

    await fresh.head()
    await fresh.commit(change, 'content: a', 'c1')

    expect(requests.filter(request => request.url === repo)).toHaveLength(2)
  })
})

describe('checks on GitHub', () => {
  const github = () => createGitHubForge({ type: 'github', repository: { owner: 'acme', name: 'site' } }, token)
  const repo = '/repos/acme/site'
  const runs = `${repo}/actions/runs?head_sha=c1&per_page=100`
  const statuses = `${repo}/commits/c1/status?per_page=100`
  const apps = `${repo}/commits/c1/check-runs?per_page=100`

  function run(name: string, event: string, status: string, conclusion: string | null, path = `.github/workflows/${name}.yml`) {
    return { name, event, path, status, conclusion, html_url: `https://github.com/acme/site/actions/runs/${name}` }
  }

  it('reads the workflows the push started, commit statuses and checks of other apps', async () => {
    serve({
      [runs]: {
        workflow_runs: [
          run('build', 'push', 'in_progress', null),
          run('deploy', 'workflow_run', 'completed', 'failure'),
          run('pages build and deployment', 'dynamic', 'completed', 'success', 'dynamic/pages/pages-build-deployment'),
          run('lint', 'push', 'completed', 'skipped'),
          run('stale', 'schedule', 'completed', 'failure'),
          run('triage', 'issue_comment', 'completed', 'failure'),
          run('Copilot code review', 'dynamic', 'completed', 'failure', 'dynamic/copilot-pull-request-reviewer/copilot-pull-request-reviewer'),
        ],
      },
      [statuses]: {
        statuses: [
          { context: 'netlify/site/deploy', state: 'pending', target_url: 'https://app.netlify.com/sites/site/deploys/1' },
          { context: 'legacy', state: 'error', target_url: null },
        ],
      },
      [apps]: {
        check_runs: [
          { name: 'build', status: 'in_progress', conclusion: null, html_url: 'https://github.com/acme/site/runs/1', details_url: null, app: { slug: 'github-actions' } },
          { name: 'Cloudflare Pages', status: 'completed', conclusion: 'success', html_url: null, details_url: 'https://dash.cloudflare.com/1', app: { slug: 'cloudflare-workers-and-pages' } },
          { name: 'Vercel', status: 'queued', conclusion: null, html_url: null, details_url: null, app: { slug: 'vercel' } },
        ],
      },
    })

    expect(await github().checks('c1')).toEqual([
      { name: 'build', state: 'pending', url: 'https://github.com/acme/site/actions/runs/build' },
      { name: 'deploy', state: 'failure', url: 'https://github.com/acme/site/actions/runs/deploy' },
      { name: 'pages build and deployment', state: 'success', url: 'https://github.com/acme/site/actions/runs/pages build and deployment' },
      { name: 'lint', state: 'skipped', url: 'https://github.com/acme/site/actions/runs/lint' },
      { name: 'netlify/site/deploy', state: 'pending', url: 'https://app.netlify.com/sites/site/deploys/1' },
      { name: 'legacy', state: 'failure' },
      { name: 'Cloudflare Pages', state: 'success', url: 'https://dash.cloudflare.com/1' },
      { name: 'Vercel', state: 'pending' },
    ])
  })

  it('stops asking for checks of other apps once the token can\'t read them', async () => {
    const requests = serve({
      [runs]: { workflow_runs: [run('build', 'push', 'completed', 'success')] },
      [statuses]: { statuses: [] },
      [apps]: 403,
    })
    const forge = github()

    expect(await forge.checks('c1')).toEqual([{ name: 'build', state: 'success', url: 'https://github.com/acme/site/actions/runs/build' }])
    expect(await forge.checks('c1')).toHaveLength(1)
    expect(requests.filter(request => request.url === apps)).toHaveLength(1)
  })

  it('reads what it may when the token can read only one of workflows and statuses', async () => {
    serve({ [runs]: 403, [statuses]: { statuses: [{ context: 'ci', state: 'success', target_url: 'https://ci.acme.com/1' }] }, [apps]: 403 })

    expect(await github().checks('c1')).toEqual([{ name: 'ci', state: 'success', url: 'https://ci.acme.com/1' }])
  })

  it('names the missing permissions when the token can read neither', async () => {
    serve({ [runs]: 403, [statuses]: 403, [apps]: 403 })

    await expect(github().checks('c1')).rejects.toThrow('give it read access to actions and commit statuses')
  })

  it('knows whether a commit contains another from the comparison', async () => {
    const requests = serve({
      [`${repo}/compare/c3...c1?per_page=1`]: { status: 'behind', ahead_by: 0, behind_by: 2 },
      [`${repo}/compare/c0...c1?per_page=1`]: { status: 'ahead', ahead_by: 1, behind_by: 0 },
    })
    const forge = github()

    expect(await forge.contains('c3', 'c1')).toBe(true)
    expect(await forge.contains('c0', 'c1')).toBe(false)
    expect(await forge.contains('c1', 'c1')).toBe(true)
    expect(requests).toHaveLength(2)
  })
})
