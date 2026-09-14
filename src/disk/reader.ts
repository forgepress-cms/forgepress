import type { ContentReader } from '../query/client'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

export const OUTPUT_VARIABLE = 'FORGEPRESS_OUTPUT'

export function diskReader(dir: () => Promise<string>): ContentReader {
  return async (path) => {
    try {
      return JSON.parse(await readFile(join(await dir(), path), 'utf8'))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return undefined

      throw error
    }
  }
}

async function locate(): Promise<string> {
  const known = process.env[OUTPUT_VARIABLE]

  if (known)
    return known

  const { locateOutput } = await import('./locate')

  return locateOutput(process.cwd())
}

let located: Promise<string> | undefined

export const reader: ContentReader = diskReader(() => (located ??= locate()))
