import type { ProviderConfig } from '../config/types'
import type { TreeItem } from './repository'
import type { BuildCheck, CheckState, Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { base64ToText, textToBase64 } from '../utils/encoding'
import { describe } from './providers'
import { publishable } from './publish'
import { blobs, createRepositoryApi, findTree, toIdentity } from './repository'

const PAGE_SIZE = 1000
const STATUS_LIMIT = 50
const SCHEDULED = /\(schedule\)$/

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

interface Tree {
  total_count: number
  tree: TreeItem[]
}

interface CommitStatus {
  status: string
  context: string
  target_url: string | null
}

function statusState(status: string): CheckState {
  if (status === 'success' || status === 'pending')
    return status

  return status === 'failure' || status === 'error' ? 'failure' : 'skipped'
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export function createForgejoForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api, root } = describe(config)
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
    return (await repo.find<{ sha: string }>(`/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`))?.sha
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, repository] = await Promise.all([
        repo.call<{ login: string, full_name: string | null, avatar_url: string | null }>(`${api}/user`),
        repo.details<Repository>(),
      ])

      return {
        identity: toIdentity(user.login, user.full_name, user.avatar_url),
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

      return blobs(directory, await entries(tree, true))
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

    async checks(commit): Promise<BuildCheck[]> {
      const found = await repo.call<{ statuses: CommitStatus[] | null }>(`/commits/${commit}/status?limit=${STATUS_LIMIT}`)

      return (found.statuses ?? [])
        .filter(status => !SCHEDULED.test(status.context))
        .map(status => ({
          name: status.context,
          state: statusState(status.status),
          ...status.target_url ? { url: new URL(status.target_url, `${root}/`).href } : {},
        }))
    },

    async contains(commit, ancestor): Promise<boolean> {
      return commit === ancestor || (await repo.call<{ total_commits: number }>(`/compare/${commit}...${ancestor}`)).total_commits === 0
    },
  }
}
