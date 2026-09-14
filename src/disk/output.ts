import type { ResolvedConfig } from '../config/resolve'
import type { OutputFile } from '../output/types'
import type { ContentIssue } from '../types/issues'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { ContentError } from '../files/issues'
import { createOutput } from '../output'
import { OUTPUT_INDEX } from '../output/types'
import { loadContent } from './check'
import { readCommit } from './commit'

const HASHED_FILE = /^[^/]+(?:\/[^/]+)*\/[\w-]+\.[\da-f]{8}\.json$/

export interface BuildOptions {
  dev?: boolean
}

export interface BuildResult {
  dir: string
  files: number
  commit: string | null
  issues: ContentIssue[]
}

const queues = new Map<string, Promise<void>>()

function isOutputFile(path: string): boolean {
  return path === OUTPUT_INDEX || HASHED_FILE.test(path)
}

async function place(path: string, text: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`

  await mkdir(dirname(path), { recursive: true })
  await writeFile(temporary, text)
  await rename(temporary, path)
}

async function listFiles(dir: string): Promise<string[]> {
  const items = await readdir(dir, { withFileTypes: true, recursive: true })

  return items.filter(item => item.isFile()).map(item => relative(dir, join(item.parentPath, item.name)).split(sep).join('/'))
}

function ancestors(folder: string): string[] {
  return folder === '.' || folder === '' ? [] : [folder, ...ancestors(dirname(folder))]
}

async function removeEmpty(path: string): Promise<void> {
  try {
    await rmdir(path)
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (code !== 'ENOTEMPTY' && code !== 'EEXIST' && code !== 'ENOENT')
      throw error
  }
}

async function prune(dir: string, folders: readonly string[]): Promise<void> {
  const candidates = [...new Set(folders.flatMap(ancestors))]

  for (const folder of candidates.sort((left, right) => right.split('/').length - left.split('/').length))
    await removeEmpty(join(dir, folder))
}

export function outputDir(root: string, config: ResolvedConfig): string {
  const dir = join(root, config.output.dir)
  const inside = relative(root, dir)

  if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))
    throw new Error(`[forgepress] the output folder has to be inside the project, not ${JSON.stringify(config.output.dir)}`)

  return dir
}

async function write(dir: string, files: readonly OutputFile[]): Promise<void> {
  const index = files.at(-1)

  if (index?.path !== OUTPUT_INDEX)
    throw new Error(`[forgepress] the content output has to end with ${OUTPUT_INDEX}`)

  const hashed = files.slice(0, -1).filter(file => !existsSync(join(dir, file.path)))

  await Promise.all(hashed.map(file => place(join(dir, file.path), file.text)))
  await place(join(dir, index.path), index.text)

  const kept = new Set(files.map(file => file.path))
  const stale = (await listFiles(dir)).filter(path => isOutputFile(path) && !kept.has(path))

  await Promise.all(stale.map(path => rm(join(dir, path), { force: true })))
  await prune(dir, stale.map(path => dirname(path)))
}

export function writeOutput(dir: string, files: readonly OutputFile[]): Promise<void> {
  const next = (queues.get(dir) ?? Promise.resolve()).catch(() => undefined).then(() => write(dir, files))

  queues.set(dir, next)

  return next
}

export async function buildOutput(root: string, config: ResolvedConfig, options: BuildOptions = {}): Promise<BuildResult> {
  const dir = outputDir(root, config)
  const { issues, schema, content } = await loadContent(root, config.paths)

  if (!schema || (issues.length > 0 && !options.dev))
    throw new ContentError(issues)

  const commit = options.dev ? null : readCommit(root)
  const files = await createOutput(schema, content, { commit, ...options.dev ? { dev: true } : {} })

  await writeOutput(dir, files)

  return { dir: config.output.dir, files: files.length, commit, issues }
}
