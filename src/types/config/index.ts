import type { ContentConfig } from './content'
import type { MediaConfig } from './media'
import type { ProviderConfig } from './provider'

export interface ForgePressConfig {
  path?: string
  provider?: ProviderConfig
  content?: ContentConfig
  media?: MediaConfig
}
