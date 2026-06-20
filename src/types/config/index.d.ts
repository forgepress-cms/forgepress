import type { ContentConfig } from './content'
import type { ProviderConfig } from './provider'

export interface WebenvConfig {
  name?: string
  provider?: ProviderConfig
  content?: ContentConfig
}
