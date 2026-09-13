import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { DEFAULT_CONTENT_PATH } from './paths'

export const CONFIG_FILES = ['forgepress.config.mjs', 'forgepress.config.js'] as const

function marks(dir: string, contentPath: string): boolean {
  return CONFIG_FILES.some(file => existsSync(join(dir, file))) || existsSync(join(dir, contentPath))
}

export function findRoot(start: string = process.cwd(), contentPath: string = DEFAULT_CONTENT_PATH): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (marks(dir, contentPath))
      return dir

    if (dir === dirname(dir))
      return start
  }
}
