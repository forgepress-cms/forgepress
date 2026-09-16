import type { ForgePressConfig } from '../config/types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { errorMessage } from '../utils/error'
import { CONFIG_FILES } from './root'

interface ConfigModule {
  default?: ForgePressConfig
}

const TYPESCRIPT = /\.m?ts$/

let imports = 0

async function importConfig(path: string): Promise<ConfigModule> {
  const url = pathToFileURL(path)

  imports += 1
  url.search = String(imports)

  try {
    return await import(url.href) as ConfigModule
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND')
      throw error

    return await import(path) as ConfigModule
  }
}

function reason(file: string, cause: unknown): string {
  if (TYPESCRIPT.test(file) && !process.features.typescript)
    return `Node.js ${process.versions.node} can't run TypeScript. Use Node.js 22.18 or newer, or write the config as forgepress.config.mjs`

  return errorMessage(cause)
}

export function configFile(root: string): string | undefined {
  return CONFIG_FILES.find(file => existsSync(join(root, file)))
}

export async function loadConfig(root: string): Promise<ForgePressConfig | undefined> {
  const file = configFile(root)

  if (!file)
    return undefined

  try {
    return (await importConfig(join(root, file))).default
  }
  catch (cause) {
    throw new Error(`[forgepress] could not load ${file}: ${reason(file, cause)}`, { cause })
  }
}
