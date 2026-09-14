import type { ContentIssue } from '../types/issues'
import type { Conflict, FileChange, Forge, RepoTarget } from './types'
import { ContentError } from '../files/issues'
import { prefixer } from '../files/paths'
import { base64ToBytes, digest } from '../utils/encoding'

export type Verify = (listing: ReadonlyMap<string, string>) => Promise<readonly ContentIssue[]>

export class ConflictError extends Error {
  readonly conflicts: readonly Conflict[]
  readonly commit: string

  constructor(conflicts: readonly Conflict[], commit: string) {
    super(`[forgepress] ${conflicts.map(conflict => conflict.path).join(', ')} changed in the repository after the last edit here`)
    this.name = 'ConflictError'
    this.conflicts = conflicts
    this.commit = commit
  }
}

export class InvalidContentError extends ContentError {
  readonly commit: string

  constructor(issues: readonly ContentIssue[], commit: string) {
    super(issues)
    this.name = 'InvalidContentError'
    this.commit = commit
  }
}

export async function gitHash(data: Uint8Array, algorithm: 'SHA-1' | 'SHA-256'): Promise<string> {
  const header = new TextEncoder().encode(`blob ${data.byteLength}\0`)
  const object = new Uint8Array(header.byteLength + data.byteLength)

  object.set(header)
  object.set(data, header.byteLength)

  return digest(algorithm, object)
}

export function commitMessage(template: string | undefined, name: string): string {
  const trimmed = name.trim()

  if (!template)
    return trimmed || 'Update content'

  return template.includes('{name}')
    ? template.replace('{name}', trimmed || 'update content')
    : `${template} ${trimmed}`.trim()
}

export function publishable<TFile>(files: readonly TFile[]): readonly TFile[] {
  if (files.length === 0)
    throw new Error('[forgepress] there is nothing to publish')

  return files
}

async function applied(file: FileChange, hash: string | null): Promise<boolean> {
  if ('removed' in file)
    return hash === null

  if (hash === null)
    return false

  const data = file.encoding === 'base64' ? base64ToBytes(file.data) : new TextEncoder().encode(file.data)

  return await gitHash(data, hash.length === 64 ? 'SHA-256' : 'SHA-1') === hash
}

async function checkConflicts(files: FileChange[], listing: ReadonlyMap<string, string>, parent: string): Promise<FileChange[]> {
  const pending: FileChange[] = []
  const conflicts: Conflict[] = []

  for (const file of files) {
    const hash = listing.get(file.path) ?? null

    if (file.replaces === undefined || file.replaces === hash)
      pending.push(file)
    else if (!await applied(file, hash))
      conflicts.push({ path: file.path, hash })
  }

  if (conflicts.length > 0)
    throw new ConflictError(conflicts, parent)

  return pending
}

export async function publishFiles(forge: Forge, files: FileChange[], message: string, target: RepoTarget, verify: Verify): Promise<string> {
  const directory = prefixer(target.base)(target.paths.dir)

  async function attempt(again: boolean): Promise<string> {
    const parent = await forge.head()
    const listing = new Map((await forge.files(parent, directory)).map(file => [file.path, file.sha]))
    const pending = await checkConflicts(files, listing, parent)

    if (pending.length === 0)
      return parent

    const issues = await verify(listing)

    if (issues.length > 0)
      throw new InvalidContentError(issues, parent)

    try {
      return await forge.commit(pending, message, parent)
    }
    catch (error) {
      if (again && await forge.head().then(head => head !== parent, () => false))
        return attempt(false)

      throw error
    }
  }

  return attempt(true)
}
