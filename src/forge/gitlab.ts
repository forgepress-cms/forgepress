import type { ProviderConfig } from '../types/config'
import type { FileChange, Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { describe } from '.'

const DEVELOPER = 30
const PAGE_SIZE = 100

interface Project {
  default_branch: string
  permissions?: {
    project_access?: { access_level?: number } | null
    group_access?: { access_level?: number } | null
  }
}

interface ExistingFile {
  last_commit_id: string
}

interface TreeItem {
  id: string
  type: string
  path: string
}

function writable(project: Project): boolean {
  const levels = [project.permissions?.project_access?.access_level, project.permissions?.group_access?.access_level]

  return levels.some(level => typeof level === 'number' && level >= DEVELOPER)
}

function nextPage(link: string | null): string | undefined {
  return link?.split(',').map(part => /<([^>]+)>;\s*rel="next"/.exec(part)?.[1]).find(url => url !== undefined)
}

export function createGitLabForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const base = `${api}/projects/${encodeURIComponent(`${config.repository.owner}/${config.repository.name}`)}`

  let branch = config.repository.branch

  async function send(path: string, init?: RequestInit): Promise<Response> {
    return fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await token()}`,
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })
  }

  async function check(response: Response): Promise<Response> {
    if (!response.ok)
      throw new Error(`[forgepress] GitLab ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response
  }

  async function call<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await check(await send(path, init))

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  async function branchName(): Promise<string> {
    branch ??= (await call<Project>('')).default_branch

    return branch
  }

  async function existing(path: string, ref: string): Promise<ExistingFile | undefined> {
    const response = await send(`/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`)

    if (response.status === 404)
      return undefined

    return await (await check(response)).json() as ExistingFile
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, project] = await Promise.all([
        call<{ username: string, name: string | null, avatar_url: string | null }>(`${api}/user`),
        call<Project>(''),
      ])

      branch ??= project.default_branch

      return {
        identity: {
          login: user.username,
          ...user.name ? { name: user.name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: writable(project),
        branch,
      }
    },

    async head(): Promise<string> {
      return (await call<{ commit: { id: string } }>(`/repository/branches/${encodeURIComponent(await branchName())}`)).commit.id
    },

    async files(commit, directory): Promise<ForgeFile[]> {
      const files: ForgeFile[] = []
      let page: string | undefined = `/repository/tree?path=${encodeURIComponent(directory)}&ref=${encodeURIComponent(commit)}&recursive=true&per_page=${PAGE_SIZE}&pagination=keyset`

      while (page) {
        const response = await send(page)

        if (response.status === 404)
          return []

        const items = await (await check(response)).json() as TreeItem[]

        files.push(...items.filter(item => item.type === 'blob').map(item => ({ path: item.path, sha: item.id })))
        page = nextPage(response.headers.get('link'))
      }

      return files
    },

    async read(sha): Promise<string> {
      return (await check(await send(`/repository/blobs/${sha}/raw`))).text()
    },

    async commit(files: FileChange[], message: string, parent: string): Promise<string> {
      if (files.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const actions = (await Promise.all(files.map(async (file) => {
        const found = await existing(file.path, parent)

        if ('removed' in file) {
          return found ? { action: 'delete', file_path: file.path, last_commit_id: found.last_commit_id } : undefined
        }

        return found
          ? { action: 'update', file_path: file.path, content: file.data, encoding: file.encoding === 'base64' ? 'base64' : 'text', last_commit_id: found.last_commit_id }
          : { action: 'create', file_path: file.path, content: file.data, encoding: file.encoding === 'base64' ? 'base64' : 'text' }
      }))).filter(action => action !== undefined)

      if (actions.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const created = await call<{ id: string }>('/repository/commits', {
        method: 'POST',
        body: JSON.stringify({ branch: await branchName(), commit_message: message, actions }),
      })

      return created.id
    },
  }
}
