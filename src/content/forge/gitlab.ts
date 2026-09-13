import type { ProviderConfig } from '../../types/config/provider'
import type { FileChange, Forge, ForgeAccess, TokenGetter } from '../../types/content/forge'
import { describe } from './index'

const DEVELOPER = 30

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

function writable(project: Project): boolean {
  const levels = [project.permissions?.project_access?.access_level, project.permissions?.group_access?.access_level]

  return levels.some(level => typeof level === 'number' && level >= DEVELOPER)
}

export function createGitLabForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const base = `${api}/projects/${encodeURIComponent(`${config.repository.owner}/${config.repository.name}`)}`

  async function call<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await token()}`,
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })

    if (!response.ok)
      throw new Error(`[forgepress] GitLab ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  async function existing(path: string, branch: string): Promise<ExistingFile | undefined> {
    const url = `${base}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`
    const response = await fetch(url, { headers: { authorization: `Bearer ${await token()}` } })

    if (response.status === 404)
      return undefined

    if (!response.ok)
      throw new Error(`[forgepress] GitLab ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return await response.json() as ExistingFile
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, project] = await Promise.all([
        call<{ username: string, name: string | null, avatar_url: string | null }>(`${api}/user`),
        call<Project>(''),
      ])

      return {
        identity: {
          login: user.username,
          ...user.name ? { name: user.name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: writable(project),
        branch: config.repository.branch ?? project.default_branch,
      }
    },

    async commit(files: FileChange[], message: string): Promise<string> {
      if (files.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const branch = config.repository.branch ?? (await call<Project>('')).default_branch

      const actions = (await Promise.all(files.map(async (file) => {
        const found = await existing(file.path, branch)

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
        body: JSON.stringify({ branch, commit_message: message, actions }),
      })

      return created.id
    },
  }
}
