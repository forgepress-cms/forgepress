import type { ContentConfig } from '../files'
import type { ProviderConfig } from '../forge'
import type { MediaConfig } from '../media'
import type { OutputConfig } from '../output'

export interface Config {
  path?: string
  provider?: ProviderConfig
  content?: ContentConfig
  media?: MediaConfig
  output?: OutputConfig
}
