import type { ProviderConfig } from './provider'

export interface RepositoryConfig {
  owner: string
  name: string
  branch?: string
}

export interface WebenvConfig {
  name?: string
  provider: ProviderConfig
}
