/// <reference path="./virtual.d.ts" />
import type { EditorSettings } from '../src/config/settings'
import type { ContentPaths } from '../src/files/paths'
import { createPaths } from '../src/files/paths'
import { once } from '../src/utils/once'

export interface BakedSettings extends Omit<EditorSettings, 'contentPath'> {
  paths: ContentPaths
}

export const baked = once(async (): Promise<BakedSettings> => {
  const { contentPath, ...settings } = (await import('virtual:forgepress/settings')).default

  return { ...settings, paths: createPaths(contentPath) }
})
