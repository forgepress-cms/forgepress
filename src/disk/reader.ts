import type { ContentReader } from '../query/client'
import { join } from 'node:path'
import process from 'node:process'
import { once } from '../utils/once'
import { readText } from './files'

export const OUTPUT_VARIABLE = 'FORGEPRESS_OUTPUT'

export function diskReader(dir: () => Promise<string>): ContentReader {
  return async (path) => {
    const text = await readText(join(await dir(), path))

    return text === undefined ? undefined : JSON.parse(text)
  }
}

async function locate(): Promise<string> {
  const known = process.env[OUTPUT_VARIABLE]

  if (known)
    return known

  const { locateOutput } = await import('./locate')

  return locateOutput(process.cwd())
}

export const reader: ContentReader = diskReader(once(locate))
