/// <reference path="./virtual.d.ts" />
import type { EditorSettings } from '../src/config'
import type { ContentPaths } from '../src/files'
import { createPaths } from '../src/files'
import { once } from '../src/utils'

export interface BakedSettings extends Omit<EditorSettings, 'contentPath'> {
  paths: ContentPaths
}

export const baked = once(async (): Promise<BakedSettings> => {
  const { contentPath, ...settings } = (await import('virtual:forgepress/settings')).default

  return { ...settings, paths: createPaths(contentPath) }
})
