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

export interface Forge {
  access: () => Promise<ForgeAccess>
  commit: (files: FileChange[], message: string) => Promise<string>
}
