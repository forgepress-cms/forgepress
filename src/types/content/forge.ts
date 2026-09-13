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

export interface Forge {
  access: () => Promise<ForgeAccess>
  commit: (files: FileChange[], message: string) => Promise<string>
}
