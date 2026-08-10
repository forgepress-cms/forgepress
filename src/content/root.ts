import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { WEBENV_DIR } from './paths'

/** Walk up from `start` until a directory containing `.webenv` is found. */
export function findRoot(start: string = process.cwd()): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, WEBENV_DIR)))
      return dir
    if (dir === dirname(dir))
      return start
  }
}
