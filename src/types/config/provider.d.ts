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
  commitMessage?: string
}
