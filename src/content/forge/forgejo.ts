import type { ProviderConfig } from '../../types/config/provider'
import type { FileChange, Forge, ForgeAccess, TokenGetter } from '../../types/content/forge'
import { describe, textToBase64 } from './index'

interface Repository {
  default_branch: string
  permissions?: { push?: boolean }
}

export function createForgejoForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const { owner, name } = config.repository
  const base = `${api}/repos/${owner}/${name}`

  async function call<TResult>(path: string, init?: RequestInit): Promise<TResult> {
    const response = await fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await token()}`,
        accept: 'application/json',
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })

    if (!response.ok)
      throw new Error(`[forgepress] Forgejo ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  async function sha(path: string, branch: string): Promise<string | undefined> {
    const url = `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`
    const response = await fetch(url, { headers: { authorization: `Bearer ${await token()}`, accept: 'application/json' } })

    if (response.status === 404)
      return undefined

    if (!response.ok)
      throw new Error(`[forgepress] Forgejo ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return (await response.json() as { sha: string }).sha
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

    async commit(files: FileChange[], message: string): Promise<string> {
      if (files.length === 0)
        throw new Error('[forgepress] there is nothing to publish')

      const branch = config.repository.branch ?? (await call<Repository>('')).default_branch

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
