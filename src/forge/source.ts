import type { ContentPaths } from '../files/paths'
import type { ContentSource, RepositoryCache } from '../store/types'
import type { ContentRow } from '../types/entry'
import type { Forge, HashSource } from './types'
import { sortByCreation } from '../entries/order'
import { parseEntry, parseSchema } from '../files/parse'
import { isEntryFile, isEntryId, prefixer } from '../files/paths'

const CONCURRENCY = 8

export interface ForgeSource extends ContentSource {
  hashes: HashSource
  read: (sha: string) => Promise<string>
  reset: (commit?: string) => void
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

export function createForgeSource(forge: () => Forge | undefined, paths: ContentPaths, base?: string, cache?: RepositoryCache): ForgeSource {
  const at = prefixer(base)
  const queue = limit(CONCURRENCY)
  const texts = new Map<string, Promise<string>>()

  let snapshot: Promise<ReadonlyMap<string, string>> | undefined
  let pinned: string | undefined

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

  async function listing(commit: string): Promise<ReadonlyMap<string, string>> {
    const directory = at(paths.dir)
    const stored = await cache?.readListing(commit, directory).catch(() => undefined)

    if (stored)
      return stored

    const listed = new Map((await client().files(commit, directory)).map(file => [file.path, file.sha]))

    if (forge())
      cache?.writeListing(commit, directory, listed).catch(() => undefined)

    return listed
  }

  async function load(): Promise<ReadonlyMap<string, string>> {
    const commit = pinned ?? await client().head()
    const listed = await listing(commit)

    await restore(new Set(listed.values()))

    return listed
  }

  function files(): Promise<ReadonlyMap<string, string>> {
    if (!snapshot) {
      const loading = load()

      snapshot = loading
      loading.catch(() => {
        if (snapshot === loading)
          snapshot = undefined
      })
    }

    return snapshot
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
    return (await files()).get(path)
  }

  async function list(collection: string): Promise<ContentRow[]> {
    const directory = `${at(paths.collection(collection))}/`

    const rows = [...await files()]
      .filter(([path]) => path.startsWith(directory) && isEntryFile(path.slice(directory.length)))
      .map(async ([path, sha]) => parseEntry(await text(sha), path))

    return sortByCreation(await Promise.all(rows))
  }

  return {
    schema: async () => {
      const path = at(paths.schema)
      const sha = await hash(path)

      if (sha === undefined)
        throw new Error(`[forgepress] ${path} does not exist in the repository`)

      return parseSchema(await text(sha), path)
    },

    list,

    entry: async (collection, id) => {
      const path = at(paths.entry(collection, id))
      const sha = isEntryId(id) ? await hash(path) : undefined

      return sha === undefined ? undefined : parseEntry(await text(sha), path)
    },

    hashes: {
      entry: async (collection, id) => isEntryId(id) ? hash(at(paths.entry(collection, id))) : undefined,
    },

    read: text,

    reset: (commit) => {
      pinned = commit
      snapshot = undefined
    },
  }
}
