import type { ProviderConfig } from '../types/config'
import type { Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { describe } from '.'

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

interface Tree {
  truncated: boolean
  tree: { path: string, type: string, sha: string }[]
}

export function createGitHubForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const base = `${api}/repos/${owner}/${name}`

  async function send(path: string, init?: RequestInit, accept = 'application/vnd.github+json'): Promise<Response> {
    return fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        'accept': accept,
        'authorization': `Bearer ${await token()}`,
        'x-github-api-version': '2022-11-28',
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })
  }

  async function check(response: Response): Promise<Response> {
    if (!response.ok)
      throw new Error(`[forgepress] GitHub ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response
  }

  async function call<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await check(await send(path, init))

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  function post<TResult>(path: string, body: unknown): Promise<TResult> {
    return call<TResult>(path, { method: 'POST', body: JSON.stringify(body) })
  }

  async function branchName(): Promise<string> {
    return config.repository.branch ?? (await call<Repository>('')).default_branch
  }

  async function folder(commit: string, directory: string): Promise<string | undefined> {
    let sha = commit

    for (const segment of directory.split('/')) {
      const found = (await call<Tree>(`/git/trees/${sha}`)).tree.find(item => item.path === segment && item.type === 'tree')

      if (!found)
        return undefined

      sha = found.sha
    }

    return sha
  }

  async function tip(branch: string): Promise<string> {
    const ref = await call<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`)

    return ref.object.sha
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, repository] = await Promise.all([
        call<{ login: string, name: string | null, avatar_url: string }>(`${api}/user`),
        call<Repository>(''),
      ])

      return {
        identity: {
          login: user.login,
          ...user.name ? { name: user.name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: repository.permissions?.push === true,
        branch: config.repository.branch ?? repository.default_branch,
      }
    },

    head: async () => tip(await branchName()),

    async files(commit, directory): Promise<ForgeFile[]> {
      const sha = await folder(commit, directory)

      if (!sha)
        return []

      const tree = await call<Tree>(`/git/trees/${sha}?recursive=1`)

      if (tree.truncated)
        throw new Error(`[forgepress] GitHub lists too many files in ${directory} to read them in one request`)

      return tree.tree
        .filter(item => item.type === 'blob')
        .map(item => ({ path: `${directory}/${item.path}`, sha: item.sha }))
    },

    async read(sha): Promise<string> {
      return (await check(await send(`/git/blobs/${sha}`, undefined, 'application/vnd.github.raw+json'))).text()
    },

    async commit(files, message): Promise<string> {
      if (files.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const branch = await branchName()
      const latest = await tip(branch)
      const parent = await call<{ tree: { sha: string } }>(`/git/commits/${latest}`)

      const tree = await Promise.all(files.map(async (file) => {
        if ('removed' in file)
          return { path: file.path, mode: '100644', type: 'blob', sha: null }

        const blob = await post<{ sha: string }>('/git/blobs', { content: file.data, encoding: file.encoding })

        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
      }))

      const next = await post<{ sha: string }>('/git/trees', { base_tree: parent.tree.sha, tree })
      const created = await post<{ sha: string }>('/git/commits', { message, tree: next.sha, parents: [latest] })

      await call(`/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: created.sha, force: false }),
      })

      return created.sha
    },
  }
}
