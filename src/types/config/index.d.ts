import type { ContentConfig } from './content'
import type { EditorConfig } from './editor'
import type { MediaConfig } from './media'
import type { ProviderConfig } from './provider'

export interface WebenvConfig {
  name?: string
  path?: string

  provider?: ProviderConfig
  content?: ContentConfig
  editor?: EditorConfig
  media?: MediaConfig
}
