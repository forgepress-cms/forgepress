import type { ContentPaths } from '../../content/paths'
import type { ContentConfig } from '../config/content'

export interface RepoTarget {
  paths: ContentPaths
  mediaDir: string
  base?: string | undefined
  format?: ContentConfig | undefined
}
