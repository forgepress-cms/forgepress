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
  = { path: string, data: string, encoding: 'utf-8' | 'base64' }
    | { path: string, removed: true }

export type TokenGetter = () => Promise<string>

export interface OAuthEndpoints {
  authorize: string
  token: string
}

export interface ForgeDescriptor {
  root: string
  api: string
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

export interface Forge {
  access: () => Promise<ForgeAccess>
  head: () => Promise<string>
  files: (commit: string, directory: string) => Promise<ForgeFile[]>
  read: (sha: string) => Promise<string>
  commit: (files: FileChange[], message: string) => Promise<string>
}

export interface RepoTarget {
  paths: ContentPaths
  mediaDir: string
  base?: string | undefined
  format?: ContentConfig | undefined
}
