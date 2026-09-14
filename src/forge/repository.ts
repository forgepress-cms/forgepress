import type { ProviderConfig } from '../types/config'
import type { TokenGetter } from './types'
import { describe } from './providers'

export type ApiInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }

export interface TreeItem {
  path: string
  type: string
  sha: string
}

interface Details {
  default_branch: string
}

export interface RepositoryApi {
  send: (path: string, init?: ApiInit) => Promise<Response>
  check: (response: Response) => Promise<Response>
  call: <TResult>(path: string, init?: ApiInit) => Promise<TResult>
  post: <TResult>(path: string, body: unknown) => Promise<TResult>
  details: <TDetails extends Details>() => Promise<TDetails>
  branch: () => Promise<string>
}

export function createRepositoryApi(config: ProviderConfig, base: string, token: TokenGetter, headers: Record<string, string> = {}): RepositoryApi {
  const { name } = describe(config)

  let known = config.repository.branch

  async function send(path: string, init: ApiInit = {}): Promise<Response> {
    return fetch(path.startsWith('http') ? path : `${base}${path}`, {
      ...init,
      headers: {
        ...headers,
        authorization: `Bearer ${await token()}`,
        ...init.body === undefined ? {} : { 'content-type': 'application/json' },
        ...init.headers,
      },
    })
  }

  async function check(response: Response): Promise<Response> {
    if (!response.ok)
      throw new Error(`[forgepress] ${name} ${response.status}: ${(await response.text()).slice(0, 300)}`)

    return response
  }

  async function call<TResult>(path: string, init?: ApiInit): Promise<TResult> {
    const response = await check(await send(path, init))

    return response.status === 204 ? undefined as TResult : await response.json() as TResult
  }

  function post<TResult>(path: string, body: unknown): Promise<TResult> {
    return call<TResult>(path, { method: 'POST', body: JSON.stringify(body) })
  }

  async function details<TDetails extends Details>(): Promise<TDetails> {
    const found = await call<TDetails>('')

    known ??= found.default_branch

    return found
  }

  async function branch(): Promise<string> {
    return known ?? (await details()).default_branch
  }

  return { send, check, call, post, details, branch }
}

export async function findTree(commit: string, directory: string, list: (tree: string) => Promise<TreeItem[]>): Promise<string | undefined> {
  let tree = commit

  for (const segment of directory.split('/')) {
    const found = (await list(tree)).find(item => item.path === segment && item.type === 'tree')

    if (!found)
      return undefined

    tree = found.sha
  }

  return tree
}
