import type { ProviderConfig } from '../types/config'
import type { TreeItem } from './repository'
import type { Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { base64ToText, textToBase64 } from '../utils/encoding'
import { describe } from './providers'
import { publishable } from './publish'
import { createRepositoryApi, findTree } from './repository'

const PAGE_SIZE = 1000

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

interface Tree {
  total_count: number
  tree: TreeItem[]
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export function createForgejoForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const repo = createRepositoryApi(config, `${api}/repos/${owner}/${name}`, token, { accept: 'application/json' })

  async function entries(tree: string, recursive: boolean): Promise<TreeItem[]> {
    const items: TreeItem[] = []

    for (let page = 1; ; page += 1) {
      const listed = await repo.call<Tree>(`/git/trees/${tree}?recursive=${recursive}&per_page=${PAGE_SIZE}&page=${page}`)

      items.push(...listed.tree)

      if (listed.tree.length === 0 || items.length >= listed.total_count)
        return items
    }
  }

  async function sha(path: string, ref: string): Promise<string | undefined> {
    const response = await repo.send(`/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`)

    if (response.status === 404)
      return undefined

    return (await (await repo.check(response)).json() as { sha: string }).sha
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, repository] = await Promise.all([
        repo.call<{ login: string, full_name: string | null, avatar_url: string | null }>(`${api}/user`),
        repo.details<Repository>(),
      ])

      return {
        identity: {
          login: user.login,
          ...user.full_name ? { name: user.full_name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: repository.permissions?.push === true,
        branch: await repo.branch(),
      }
    },

    async head(): Promise<string> {
      return (await repo.call<{ commit: { id: string } }>(`/branches/${encodeURIComponent(await repo.branch())}`)).commit.id
    },

    async files(commit, directory): Promise<ForgeFile[]> {
      const tree = await findTree(commit, directory, found => entries(found, false))

      if (!tree)
        return []

      return (await entries(tree, true))
        .filter(item => item.type === 'blob')
        .map(item => ({ path: `${directory}/${item.path}`, sha: item.sha }))
    },

    async read(blob): Promise<string> {
      return base64ToText((await repo.call<{ content: string }>(`/git/blobs/${blob}`)).content)
    },

    async commit(files, message, parent): Promise<string> {
      const operations = publishable((await Promise.all(files.map(async (file) => {
        const found = await sha(file.path, parent)

        if ('removed' in file)
          return found ? { operation: 'delete', path: file.path, sha: found } : undefined

        const content = file.encoding === 'base64' ? file.data : textToBase64(file.data)

        return found
          ? { operation: 'update', path: file.path, content, sha: found }
          : { operation: 'create', path: file.path, content }
      }))).filter(operation => operation !== undefined))

      const created = await repo.post<{ commit: { sha: string } }>('/contents', { branch: await repo.branch(), message, files: operations })

      return created.commit.sha
    },
  }
}
