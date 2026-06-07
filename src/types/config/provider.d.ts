export type ProviderType = 'github' | 'gitlab' | 'forgejo'

export interface ProviderConfigBase {
  type: ProviderType
  repository: RepositoryConfig
}

export interface GitHubProviderConfig extends ProviderConfigBase {
  type: 'github'
  auth: {
    clientSecret: string
    redirectUri: string
    scopes?: readonly string[]
  }
}

export interface GitLabProviderConfig extends ProviderConfigBase {
  type: 'gitlab'
  auth: {
    clientId: string
    redirectUri: string
    scopes?: readonly string[]
  }
}

export interface ForgejoProviderConfig extends ProviderConfigBase {
  type: 'forgejo'
  auth: {
    clientId: string
    redirectUri: string
    scopes?: readonly string[]
  }
}

export type ProviderConfig = GitHubProviderConfig | GitLabProviderConfig | ForgejoProviderConfig
