import type { ProviderConfig } from '../types/config'
import type { TreeItem } from './repository'
import type { Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
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

export function createGitHubForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const repo = createRepositoryApi(config, `${api}/repos/${owner}/${name}`, token, {
    'accept': 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  })

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
  }
}
