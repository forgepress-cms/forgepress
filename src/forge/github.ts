import type { ProviderConfig } from '../types/config'
import type { TreeItem } from './repository'
import type { BuildCheck, CheckState, Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { describe } from './providers'
import { publishable } from './publish'
import { createRepositoryApi, findTree } from './repository'

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

interface Tree {
  truncated: boolean
  tree: TreeItem[]
}

interface WorkflowRun {
  name: string | null
  event: string
  path: string
  status: string
  conclusion: string | null
  html_url: string
}

interface CheckRun {
  name: string
  status: string
  conclusion: string | null
  html_url: string | null
  details_url: string | null
  app: { slug: string } | null
}

interface CommitStatus {
  context: string
  state: string
  target_url: string | null
}

const BUILD_EVENTS = new Set(['push', 'workflow_run'])
const FAILED = new Set(['failure', 'timed_out', 'startup_failure'])

function runState(status: string, conclusion: string | null): CheckState {
  if (status !== 'completed' || conclusion === 'action_required')
    return 'pending'

  if (conclusion === 'success')
    return 'success'

  return conclusion !== null && FAILED.has(conclusion) ? 'failure' : 'skipped'
}

function statusState(state: string): CheckState {
  return state === 'success' || state === 'pending' ? state : 'failure'
}

function linked(url: string | null): { url: string } | Record<never, never> {
  return url ? { url } : {}
}

export function createGitHubForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const repo = createRepositoryApi(config, `${api}/repos/${owner}/${name}`, token, {
    'accept': 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  })

  let apps = true

  async function readable<TResult>(path: string): Promise<TResult | undefined> {
    const response = await repo.send(path)

    if (response.status === 403 || response.status === 404)
      return undefined

    return await (await repo.check(response)).json() as TResult
  }

  async function runs(commit: string): Promise<BuildCheck[] | undefined> {
    const found = await readable<{ workflow_runs: WorkflowRun[] }>(`/actions/runs?head_sha=${commit}&per_page=100`)

    return found?.workflow_runs
      .filter(run => BUILD_EVENTS.has(run.event) || run.path.startsWith('dynamic/pages/'))
      .map(run => ({ name: run.name ?? run.path, state: runState(run.status, run.conclusion), url: run.html_url }))
  }

  async function statuses(commit: string): Promise<BuildCheck[] | undefined> {
    const found = await readable<{ statuses: CommitStatus[] }>(`/commits/${commit}/status?per_page=100`)

    return found?.statuses.map(status => ({ name: status.context, state: statusState(status.state), ...linked(status.target_url) }))
  }

  async function others(commit: string): Promise<BuildCheck[]> {
    const found = apps ? await readable<{ check_runs: CheckRun[] }>(`/commits/${commit}/check-runs?per_page=100`) : undefined

    if (!found) {
      apps = false

      return []
    }

    return found.check_runs
      .filter(run => run.app?.slug !== 'github-actions')
      .map(run => ({ name: run.name, state: runState(run.status, run.conclusion), ...linked(run.html_url ?? run.details_url) }))
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, repository] = await Promise.all([
        repo.call<{ login: string, name: string | null, avatar_url: string }>(`${api}/user`),
        repo.details<Repository>(),
      ])

      return {
        identity: {
          login: user.login,
          ...user.name ? { name: user.name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: repository.permissions?.push === true,
        branch: await repo.branch(),
      }
    },

    async head(): Promise<string> {
      return (await repo.call<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(await repo.branch())}`)).object.sha
    },

    async files(commit, directory): Promise<ForgeFile[]> {
      const sha = await findTree(commit, directory, async tree => (await repo.call<Tree>(`/git/trees/${tree}`)).tree)

      if (!sha)
        return []

      const tree = await repo.call<Tree>(`/git/trees/${sha}?recursive=1`)

      if (tree.truncated)
        throw new Error(`[forgepress] GitHub lists too many files in ${directory} to read them in one request`)

      return tree.tree
        .filter(item => item.type === 'blob')
        .map(item => ({ path: `${directory}/${item.path}`, sha: item.sha }))
    },

    async read(sha): Promise<string> {
      return (await repo.check(await repo.send(`/git/blobs/${sha}`, { headers: { accept: 'application/vnd.github.raw+json' } }))).text()
    },

    async commit(files, message, parent): Promise<string> {
      const pending = publishable(files)
      const current = await repo.call<{ tree: { sha: string } }>(`/git/commits/${parent}`)

      const tree = await Promise.all(pending.map(async (file) => {
        if ('removed' in file)
          return { path: file.path, mode: '100644', type: 'blob', sha: null }

        const blob = await repo.post<{ sha: string }>('/git/blobs', { content: file.data, encoding: file.encoding })

        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
      }))

      const next = await repo.post<{ sha: string }>('/git/trees', { base_tree: current.tree.sha, tree })
      const created = await repo.post<{ sha: string }>('/git/commits', { message, tree: next.sha, parents: [parent] })

      await repo.call(`/git/refs/heads/${encodeURIComponent(await repo.branch())}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: created.sha, force: false }),
      })

      return created.sha
    },

    async checks(commit): Promise<BuildCheck[]> {
      const [built, reported, rest] = await Promise.all([runs(commit), statuses(commit), others(commit)])

      if (!built && !reported)
        throw new Error('[forgepress] the GitHub token can\'t read the builds of this repository; give it read access to actions and commit statuses')

      return [...built ?? [], ...reported ?? [], ...rest]
    },

    async contains(commit, ancestor): Promise<boolean> {
      return commit === ancestor || (await repo.call<{ ahead_by: number }>(`/compare/${commit}...${ancestor}?per_page=1`)).ahead_by === 0
    },
  }
}
