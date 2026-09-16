export type ProviderType = 'github' | 'gitlab' | 'forgejo'

export interface ProviderRepository {
  owner: string
  name: string
  branch?: string
}

export interface ProviderConfig {
  type: ProviderType
  repository: ProviderRepository
  base?: string
  url?: string
  clientId?: string
  scopes?: readonly string[]
  redirectUri?: string
  commitMessage?: string
}

export interface ContentConfig {
  indent?: number
  semi?: boolean
}

export interface MediaConfig {
  dir?: string
  url?: string
  maxSize?: number
}

export interface OutputConfig {
  dir?: string
}

export interface ForgePressConfig {
  path?: string
  provider?: ProviderConfig
  content?: ContentConfig
  media?: MediaConfig
  output?: OutputConfig
}
