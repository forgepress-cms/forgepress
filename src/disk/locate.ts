import { join } from 'node:path'
import { resolveConfig } from '../config/resolve'
import { loadConfig } from './config'
import { findRoot } from './root'

export async function locateOutput(start: string): Promise<string> {
  const root = findRoot(start)

  return join(root, resolveConfig(await loadConfig(root)).output.dir)
}
