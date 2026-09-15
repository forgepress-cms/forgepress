/// <reference path="./virtual.d.ts" />
import type { ContentPaths } from '../files/paths'
import type { MediaSettings } from '../media/types'
import type { ContentConfig, ProviderConfig } from '../types/config'
import { createPaths } from '../files/paths'

export interface BakedSettings {
  local: boolean
  media: MediaSettings
  provider: ProviderConfig | undefined
  format: ContentConfig | undefined
  paths: ContentPaths
}

let settings: Promise<BakedSettings> | undefined

export function baked(): Promise<BakedSettings> {
  settings ??= import('virtual:forgepress/settings').then(module => ({
    local: module.local === true,
    media: module.media,
    provider: module.provider ?? undefined,
    format: module.format ?? undefined,
    paths: createPaths(module.contentPath),
  }))

  return settings
}
