import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { createPaths, DEFAULT_CONTENT_PATH } from '../files/paths'

export const CONFIG_FILES = ['forgepress.config.mjs', 'forgepress.config.js'] as const

function ancestor(start: string, found: (dir: string) => boolean): string | undefined {
  for (let dir = start; ; dir = dirname(dir)) {
    if (found(dir))
      return dir

    if (dir === dirname(dir))
      return undefined
  }
}

export function findRoot(start: string = process.cwd(), contentPath: string = DEFAULT_CONTENT_PATH): string {
  const schema = createPaths(contentPath).schema
  const marked = (dir: string): boolean => CONFIG_FILES.some(file => existsSync(join(dir, file))) || existsSync(join(dir, schema))

  return ancestor(start, marked) ?? ancestor(start, dir => existsSync(join(dir, 'package.json'))) ?? start
}
