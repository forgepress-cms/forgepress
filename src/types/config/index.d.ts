import type { ContentConfig } from './content'
import type { EditorConfig } from './editor'
import type { ProviderConfig } from './provider'

export interface WebenvConfig {
  name?: string
  path?: string

  provider?: ProviderConfig
  content?: ContentConfig
  editor?: EditorConfig
}
