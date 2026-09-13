import type { ProviderConfig } from '../types/config'
import type { FileChange, Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { base64ToText, describe, encodePath, textToBase64 } from '.'

const PAGE_SIZE = 1000

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

interface TreeItem {
  path: string
  type: string
  sha: string
}

interface Tree {
  total_count: number
  tree: TreeItem[]
}

export function createForgejoForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const base = `${api}/repos/${owner}/${name}`

  async function send(path: string, init?: RequestInit): Promise<Response> {
    return fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await token()}`,
        accept: 'application/json',
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })
  }

  async function check(response: Response): Promise<Response> {
    if (!response.ok)
      throw new Error(`[forgepress] Forgejo ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response
  }

  async function call<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await check(await send(path, init))

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  async function branchName(): Promise<string> {
    return config.repository.branch ?? (await call<Repository>('')).default_branch
  }

  async function entries(tree: string, recursive: boolean): Promise<TreeItem[]> {
    const items: TreeItem[] = []

    for (let page = 1; ; page += 1) {
      const listed = await call<Tree>(`/git/trees/${tree}?recursive=${recursive}&per_page=${PAGE_SIZE}&page=${page}`)

      items.push(...listed.tree)

      if (listed.tree.length === 0 || items.length >= listed.total_count)
        return items
    }
  }

  async function folder(commit: string, directory: string): Promise<string | undefined> {
    let tree = commit

    for (const segment of directory.split('/')) {
      const found = (await entries(tree, false)).find(item => item.path === segment && item.type === 'tree')

      if (!found)
        return undefined

      tree = found.sha
    }

    return tree
  }

  async function sha(path: string, branch: string): Promise<string | undefined> {
    const response = await send(`/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`)

    if (response.status === 404)
      return undefined

    return (await (await check(response)).json() as { sha: string }).sha
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, repository] = await Promise.all([
        call<{ login: string, full_name: string | null, avatar_url: string | null }>(`${api}/user`),
        call<Repository>(''),
      ])

      return {
        identity: {
          login: user.login,
          ...user.full_name ? { name: user.full_name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: repository.permissions?.push === true,
        branch: config.repository.branch ?? repository.default_branch,
      }
    },

    async head(): Promise<string> {
      return (await call<{ commit: { id: string } }>(`/branches/${encodeURIComponent(await branchName())}`)).commit.id
    },

    async files(commit, directory): Promise<ForgeFile[]> {
      const tree = await folder(commit, directory)

      if (!tree)
        return []

      return (await entries(tree, true))
        .filter(item => item.type === 'blob')
        .map(item => ({ path: `${directory}/${item.path}`, sha: item.sha }))
    },

    async read(blob): Promise<string> {
      return base64ToText((await call<{ content: string }>(`/git/blobs/${blob}`)).content)
    },

    async commit(files: FileChange[], message: string): Promise<string> {
      if (files.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const branch = await branchName()

      const entries = (await Promise.all(files.map(async (file) => {
        const found = await sha(file.path, branch)

        if ('removed' in file)
          return found ? { operation: 'delete', path: file.path, sha: found } : undefined

        const content = file.encoding === 'base64' ? file.data : textToBase64(file.data)

        return found
          ? { operation: 'update', path: file.path, content, sha: found }
          : { operation: 'create', path: file.path, content }
      }))).filter(entry => entry !== undefined)

      if (entries.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const created = await call<{ commit: { sha: string } }>('/contents', {
        method: 'POST',
        body: JSON.stringify({ branch, message, files: entries }),
      })

      return created.commit.sha
    },
  }
}
