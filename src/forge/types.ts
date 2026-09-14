import type { ContentPaths } from '../files/paths'
import type { ContentConfig } from '../types/config'

export interface ForgeIdentity {
  login: string
  name?: string
  avatar?: string
}

export interface ForgeAccess {
  identity: ForgeIdentity
  writable: boolean
  branch: string
}

export type FileChange
  = { path: string, data: string, encoding: 'utf-8' | 'base64', replaces?: string | null }
    | { path: string, removed: true, replaces?: string | null }

export interface Conflict {
  path: string
  hash: string | null
}

export type TokenGetter = () => Promise<string>

export interface OAuthEndpoints {
  authorize: string
  token: string
}

export interface ForgeDescriptor {
  name: string
  root: string
  api: string
  tokens: string
  permissions: string
  scopes: readonly string[]
  oauth?: OAuthEndpoints
}

export interface OAuthTokens {
  access: string
  refresh?: string
  expires?: number
}

export interface ForgeFile {
  path: string
  sha: string
}

export type CheckState = 'pending' | 'success' | 'failure' | 'skipped'

export interface BuildCheck {
  name: string
  state: CheckState
  url?: string
}

export interface HashSource {
  entry: (collection: string, id: string) => Promise<string | undefined>
}

export interface Forge {
  access: () => Promise<ForgeAccess>
  head: () => Promise<string>
  files: (commit: string, directory: string) => Promise<ForgeFile[]>
  read: (sha: string) => Promise<string>
  commit: (files: FileChange[], message: string, parent: string) => Promise<string>
  checks: (commit: string) => Promise<BuildCheck[]>
  contains: (commit: string, ancestor: string) => Promise<boolean>
}

export interface RepoTarget {
  paths: ContentPaths
  mediaDir: string
  base?: string | undefined
  format?: ContentConfig | undefined
}
