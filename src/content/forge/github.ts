import type { ProviderConfig } from '../../types/config/provider'
import type { Forge, ForgeAccess, TokenGetter } from '../../types/content/forge'
import { describe } from './index'

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

export function createGitHubForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const base = `${api}/repos/${owner}/${name}`

  async function call<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        'accept': 'application/vnd.github+json',
        'authorization': `Bearer ${await token()}`,
        'x-github-api-version': '2022-11-28',
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })

    if (!response.ok)
      throw new Error(`[webenv] GitHub ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  function post<TResult>(path: string, body: unknown): Promise<TResult> {
    return call<TResult>(path, { method: 'POST', body: JSON.stringify(body) })
  }

  async function branchName(): Promise<string> {
    return config.repository.branch ?? (await call<Repository>('')).default_branch
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

    async commit(files, message): Promise<string> {
      if (files.length === 0)
        throw new Error('[webenv] there is nothing to publish')

      const branch = await branchName()
      const ref = await call<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`)
      const head = ref.object.sha
      const parent = await call<{ tree: { sha: string } }>(`/git/commits/${head}`)

      const tree = await Promise.all(files.map(async (file) => {
        if ('removed' in file)
          return { path: file.path, mode: '100644', type: 'blob', sha: null }

        const blob = await post<{ sha: string }>('/git/blobs', { content: file.data, encoding: file.encoding })

        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
      }))

      const next = await post<{ sha: string }>('/git/trees', { base_tree: parent.tree.sha, tree })
      const created = await post<{ sha: string }>('/git/commits', { message, tree: next.sha, parents: [head] })

      await call(`/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: created.sha, force: false }),
      })

      return created.sha
    },
  }
}
