import { afterEach, describe, expect, it, vi } from 'vitest'
import { createForgejoForge } from '../../src/forge/forgejo'
import { createGitHubForge } from '../../src/forge/github'
import { createGitLabForge } from '../../src/forge/gitlab'

function serve(routes: Record<string, unknown>): string[] {
  const requests: string[] = []

  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input)
    const key = `${url.pathname}${url.search}`
    const route = routes[key]

    requests.push(key)

    if (route === undefined)
      return new Response('Not Found', { status: 404 })

    return typeof route === 'number' ? new Response('{"message":"Resource not accessible by personal access token"}', { status: route }) : Response.json(route)
  })

  return requests
}

const token = async (): Promise<string> => 'secret'

afterEach(() => {
  vi.unstubAllGlobals()
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
    expect(requests.filter(request => request === apps)).toHaveLength(1)
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
