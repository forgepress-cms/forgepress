import type { ContentFiles } from '../files/content'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { toPosix } from './paths'

export async function listFiles(folder: string): Promise<string[]> {
  if (!existsSync(folder))
    return []

  const items = await readdir(folder, { withFileTypes: true, recursive: true })

  return items.filter(item => item.isFile()).map(item => toPosix(relative(folder, join(item.parentPath, item.name))))
}

export async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined

    throw error
  }
}

export function diskFiles(root: string): ContentFiles {
  return {
    list: async directory => (await listFiles(join(root, directory))).map(path => `${directory}/${path}`),
    read: path => readText(join(root, path)),
  }
}
