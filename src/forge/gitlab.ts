import type { ProviderConfig } from '../types/config'
import type { BuildCheck, CheckState, Forge, ForgeAccess, ForgeFile, TokenGetter } from './types'
import { describe } from './providers'
import { publishable } from './publish'
import { createRepositoryApi } from './repository'

const DEVELOPER = 30
const PAGE_SIZE = 100
const RUNNING = new Set(['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'scheduled', 'waiting_for_callback'])

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

interface Pipeline {
  id: number
  iid?: number
  name?: string | null
  status: string
  source: string
  web_url: string
}

function writable(project: Project): boolean {
  const levels = [project.permissions?.project_access?.access_level, project.permissions?.group_access?.access_level]

  return levels.some(level => typeof level === 'number' && level >= DEVELOPER)
}

function pipelineState(status: string): CheckState {
  if (status === 'success')
    return 'success'

  if (status === 'failed')
    return 'failure'

  return RUNNING.has(status) ? 'pending' : 'skipped'
}

function nextPage(link: string | null): string | undefined {
  return link?.split(',').map(part => /<([^>]+)>;\s*rel="next"/.exec(part)?.[1]).find(url => url !== undefined)
}

export function createGitLabForge(config: ProviderConfig, token: TokenGetter): Forge {
  const { api } = describe(config)
  const repo = createRepositoryApi(config, `${api}/projects/${encodeURIComponent(`${config.repository.owner}/${config.repository.name}`)}`, token)

  async function existing(path: string, ref: string): Promise<ExistingFile | undefined> {
    const response = await repo.send(`/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`)

    if (response.status === 404)
      return undefined

    return await (await repo.check(response)).json() as ExistingFile
  }

  return {
    async access(): Promise<ForgeAccess> {
      const [user, project] = await Promise.all([
        repo.call<{ username: string, name: string | null, avatar_url: string | null }>(`${api}/user`),
        repo.details<Project>(),
      ])

      return {
        identity: {
          login: user.username,
          ...user.name ? { name: user.name } : {},
          ...user.avatar_url ? { avatar: user.avatar_url } : {},
        },
        writable: writable(project),
        branch: await repo.branch(),
      }
    },

    async head(): Promise<string> {
      return (await repo.call<{ commit: { id: string } }>(`/repository/branches/${encodeURIComponent(await repo.branch())}`)).commit.id
    },

    async files(commit, directory): Promise<ForgeFile[]> {
      const files: ForgeFile[] = []
      let page: string | undefined = `/repository/tree?path=${encodeURIComponent(directory)}&ref=${encodeURIComponent(commit)}&recursive=true&per_page=${PAGE_SIZE}&pagination=keyset`

      while (page) {
        const response = await repo.send(page)

        if (response.status === 404)
          return []

        const items = await (await repo.check(response)).json() as TreeItem[]

        files.push(...items.filter(item => item.type === 'blob').map(item => ({ path: item.path, sha: item.id })))
        page = nextPage(response.headers.get('link'))
      }

      return files
    },

    async read(sha): Promise<string> {
      return (await repo.check(await repo.send(`/repository/blobs/${sha}/raw`))).text()
    },

    async commit(files, message, parent): Promise<string> {
      const actions = publishable((await Promise.all(files.map(async (file) => {
        const found = await existing(file.path, parent)

        if ('removed' in file)
          return found ? { action: 'delete', file_path: file.path, last_commit_id: found.last_commit_id } : undefined

        return found
          ? { action: 'update', file_path: file.path, content: file.data, encoding: file.encoding === 'base64' ? 'base64' : 'text', last_commit_id: found.last_commit_id }
          : { action: 'create', file_path: file.path, content: file.data, encoding: file.encoding === 'base64' ? 'base64' : 'text' }
      }))).filter(action => action !== undefined))

      const created = await repo.post<{ id: string }>('/repository/commits', { branch: await repo.branch(), commit_message: message, actions })

      return created.id
    },

    async checks(commit): Promise<BuildCheck[]> {
      const pipelines = await repo.call<Pipeline[]>(`/pipelines?sha=${commit}&per_page=${PAGE_SIZE}`)

      return pipelines
        .filter(pipeline => pipeline.source !== 'schedule')
        .map(pipeline => ({ name: pipeline.name || `Pipeline #${pipeline.iid ?? pipeline.id}`, state: pipelineState(pipeline.status), url: pipeline.web_url }))
    },

    async contains(commit, ancestor): Promise<boolean> {
      const refs = new URLSearchParams([['refs[]', commit], ['refs[]', ancestor]])

      return commit === ancestor || (await repo.call<{ id: string }>(`/repository/merge_base?${refs.toString()}`)).id === ancestor
    },
  }
}
