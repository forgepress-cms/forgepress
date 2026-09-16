import type { ContentFiles } from '../files/content'
import type { ContentPaths } from '../files/paths'
import type { ContentSource, RepositoryCache } from '../store/types'
import type { Forge, HashSource } from './types'
import { createFileSource } from '../files/content'
import { isEntryId } from '../files/paths'
import { isMediaFile } from '../media'
import { once } from '../utils/once'

const CONCURRENCY = 8

export interface ForgeSource extends ContentSource {
  hashes: HashSource
  media: () => Promise<string[]>
  read: (sha: string) => Promise<string>
  reset: (commit?: string) => void
}

export interface SourceTarget {
  paths: ContentPaths
  mediaDir?: string | undefined
}

interface Snapshot {
  commit: string
  files: ReadonlyMap<string, string>
  media: () => Promise<string[]>
}

type Task<TResult> = () => Promise<TResult>

function limit(size: number): <TResult>(task: Task<TResult>) => Promise<TResult> {
  const waiting: (() => void)[] = []
  let active = 0

  return async (task) => {
    if (active < size)
      active += 1
    else
      await new Promise<void>(resolve => waiting.push(resolve))

    try {
      return await task()
    }
    finally {
      const next = waiting.shift()

      if (next)
        next()
      else
        active -= 1
    }
  }
}

export function createForgeSource(forge: () => Forge | undefined, target: SourceTarget, cache?: RepositoryCache): ForgeSource {
  const { paths, mediaDir } = target
  const queue = limit(CONCURRENCY)
  const texts = new Map<string, Promise<string>>()

  let pinned: string | undefined
  let snapshot = once(load)

  function client(): Forge {
    const current = forge()

    if (!current)
      throw new Error('[forgepress] sign in to read the content from the repository')

    return current
  }

  async function restore(hashes: ReadonlySet<string>): Promise<void> {
    const cached = await cache?.keep(hashes).catch(() => undefined)

    for (const [sha, content] of cached ?? []) {
      if (!texts.has(sha))
        texts.set(sha, Promise.resolve(content))
    }
  }

  async function listing(commit: string, directory: string): Promise<ReadonlyMap<string, string>> {
    const stored = await cache?.readListing(commit, directory).catch(() => undefined)

    if (stored)
      return stored

    const listed = new Map((await client().files(commit, directory)).map(file => [file.path, file.sha]))

    if (forge())
      cache?.writeListing(commit, directory, listed).catch(() => undefined)

    return listed
  }

  async function uploads(commit: string): Promise<string[]> {
    if (mediaDir === undefined)
      return []

    return [...(await listing(commit, mediaDir)).keys()].map(path => path.slice(mediaDir.length + 1)).filter(isMediaFile)
  }

  async function load(): Promise<Snapshot> {
    const commit = pinned ?? await client().head()
    const listed = await listing(commit, paths.dir)

    await restore(new Set(listed.values()))

    return { commit, files: listed, media: once(() => uploads(commit)) }
  }

  function text(sha: string): Promise<string> {
    let pending = texts.get(sha)

    if (!pending) {
      pending = queue(() => client().read(sha))
      texts.set(sha, pending)
      pending.then(content => forge() && cache?.writeFile(sha, content), () => texts.delete(sha)).catch(() => undefined)
    }

    return pending
  }

  async function hash(path: string): Promise<string | undefined> {
    return (await snapshot()).files.get(path)
  }

  const files: ContentFiles = {
    list: async directory => [...(await snapshot()).files.keys()].filter(path => path.startsWith(`${directory}/`)),

    read: async (path) => {
      const sha = await hash(path)

      return sha === undefined ? undefined : text(sha)
    },
  }

  return {
    ...createFileSource(files, paths),

    hashes: {
      entry: async (collection, id) => isEntryId(id) ? hash(paths.entry(collection, id)) : undefined,
    },

    media: async () => mediaDir === undefined ? [] : (await snapshot()).media(),

    read: text,

    reset: (commit) => {
      pinned = commit
      snapshot = once(load)
    },
  }
}
