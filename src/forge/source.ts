import type { ContentPaths } from '../files/paths'
import type { ContentSource } from '../store/types'
import type { ContentRow } from '../types/entry'
import type { Forge } from './types'
import { toMeta } from '../entries/meta'
import { sortByCreation } from '../entries/order'
import { parseEntry, parseSchema } from '../files/parse'
import { isEntryFile, isEntryId, prefixer } from '../files/paths'

const CONCURRENCY = 8

export interface ForgeSource extends ContentSource {
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

export function createForgeSource(forge: () => Forge | undefined, paths: ContentPaths, base?: string): ForgeSource {
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

  async function load(): Promise<ReadonlyMap<string, string>> {
    const commit = pinned ?? await client().head()
    const files = await client().files(commit, at(paths.dir))

    return new Map(files.map(file => [file.path, file.sha]))
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
      pending.catch(() => texts.delete(sha))
    }

    return pending
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
      const sha = (await files()).get(path)

      if (sha === undefined)
        throw new Error(`[forgepress] ${path} does not exist in the repository`)

      return parseSchema(await text(sha), path)
    },

    list,

    index: async collection => (await list(collection)).map(toMeta),

    entry: async (collection, id) => {
      const path = at(paths.entry(collection, id))
      const sha = isEntryId(id) ? (await files()).get(path) : undefined

      return sha === undefined ? undefined : parseEntry(await text(sha), path)
    },

    reset: (commit) => {
      pinned = commit
      snapshot = undefined
    },
  }
}
