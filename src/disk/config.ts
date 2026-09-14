import type { ForgePressConfig } from '../types/config'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { errorMessage } from '../utils/error'
import { CONFIG_FILES } from './root'

export async function loadConfig(root: string): Promise<ForgePressConfig | undefined> {
  for (const file of CONFIG_FILES) {
    const path = join(root, file)

    if (!existsSync(path))
      continue

    try {
      return ((await import(pathToFileURL(path).href)) as { default?: ForgePressConfig }).default
    }
    catch (cause) {
      throw new Error(`[forgepress] could not load ${file}: ${errorMessage(cause)}`, { cause })
    }
  }

  return undefined
}
