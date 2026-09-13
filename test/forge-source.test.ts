import type { Forge } from '../src/forge/types'
import { describe, expect, it } from 'vitest'
import { createPaths, defaultPaths } from '../src/files/paths'
import { createForgeSource } from '../src/forge/source'

const schema = 'export default { collections: { author: { fields: { name: { type: \'text\' } } }, blogPost: { fields: {} } } }\n'

function entry(id: string, status: string, createdAt: string, name = id): string {
  return `export default { id: '${id}', status: '${status}', createdAt: '${createdAt}', updatedAt: '${createdAt}', name: '${name}' }\n`
}

const first: Record<string, string> = {
  '.forgepress/schema.ts': schema,
  '.forgepress/forgepress.d.ts': 'export {}\n',
  '.forgepress/content/author/author_2.ts': entry('author_2', 'unpublished', '2024-02-01T00:00:00Z'),
  '.forgepress/content/author/author_1.ts': entry('author_1', 'published', '2024-01-01T00:00:00Z'),
  '.forgepress/content/author/notes.md': '# notes\n',
  '.forgepress/content/author/drafts/author_3.ts': entry('author_3', 'published', '2024-03-01T00:00:00Z'),
  '.forgepress/content/author-archive/author_9.ts': entry('author_9', 'published', '2024-03-01T00:00:00Z'),
  'src/pages/index.vue': '<template />\n',
}

function repository(commits: Record<string, Record<string, string>>) {
  const blobs = new Map<string, string>()
  const calls: string[] = []
  const state = { branch: Object.keys(commits)[0]!, failures: 0 }

  const shaOf = (text: string): string => {
    const sha = `blob-${[...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7).toString(16)}`

    blobs.set(sha, text)

    return sha
  }

  const forge: Forge = {
    access: async () => {
      throw new Error('not used')
    },
    head: async () => {
      calls.push('head')

      return state.branch
    },
    files: async (commit, directory) => {
      calls.push(`files ${commit} ${directory}`)

      if (state.failures > 0) {
        state.failures -= 1
        throw new Error('GitHub 502')
      }

      return Object.entries(commits[commit] ?? {})
        .filter(([path]) => path.startsWith(`${directory}/`))
        .map(([path, text]) => ({ path, sha: shaOf(text) }))
    },
    read: async (sha) => {
      calls.push(`read ${sha}`)

      return blobs.get(sha)!
    },
    commit: async () => 'unused',
  }

  return {
    forge,
    calls,
    shaOf,
    reads: () => calls.filter(call => call.startsWith('read')).length,
    move: (commit: string) => {
      state.branch = commit
    },
    fail: (times: number) => {
      state.failures = times
    },
  }
}

describe('forge source', () => {
  it('reads the schema and every entry of a collection, unpublished ones included', async () => {
    const repo = repository({ c1: first })
    const source = createForgeSource(() => repo.forge, defaultPaths)

    expect(Object.keys((await source.schema()).collections)).toEqual(['author', 'blogPost'])
    expect((await source.list('author')).map(row => row.id)).toEqual(['author_1', 'author_2'])
    expect((await source.index('author')).map(meta => meta.status)).toEqual(['published', 'unpublished'])
    expect((await source.entry('author', 'author_2'))?.name).toBe('author_2')
  })

  it('reads nothing for entries and collections that do not exist', async () => {
    const repo = repository({ c1: first })
    const source = createForgeSource(() => repo.forge, defaultPaths)

    expect(await source.list('blogPost')).toEqual([])
    expect(await source.entry('author', 'author_4')).toBeUndefined()
    expect(await source.entry('author', '../schema')).toBeUndefined()
  })

  it('finds the content inside a larger repository', async () => {
    const nested = Object.fromEntries(Object.entries(first).map(([path, text]) => [`apps/site/${path}`, text]))
    const repo = repository({ c1: nested })
    const source = createForgeSource(() => repo.forge, createPaths('.forgepress'), 'apps/site')

    expect((await source.list('author')).map(row => row.id)).toEqual(['author_1', 'author_2'])
    expect(repo.calls).toContain('files c1 apps/site/.forgepress')
  })

  it('reads every file once and parses a fresh copy each time', async () => {
    const repo = repository({ c1: first })
    const source = createForgeSource(() => repo.forge, defaultPaths)

    const [before] = await source.list('author')
    const again = await source.list('author')

    await source.entry('author', 'author_1')
    await source.schema()
    await source.schema()

    expect(repo.reads()).toBe(3)
    expect(again[0]).toEqual(before)
    expect(again[0]).not.toBe(before)
  })

  it('stays on one commit until it is reset', async () => {
    const repo = repository({
      c1: first,
      c2: { ...first, '.forgepress/content/author/author_1.ts': entry('author_1', 'published', '2024-01-01T00:00:00Z', 'Alice') },
    })
    const source = createForgeSource(() => repo.forge, defaultPaths)

    await source.list('author')
    repo.move('c2')

    expect((await source.entry('author', 'author_1'))?.name).toBe('author_1')
    expect(repo.calls.filter(call => call === 'head')).toHaveLength(1)

    source.reset('c2')

    expect((await source.entry('author', 'author_1'))?.name).toBe('Alice')
    expect(repo.calls.filter(call => call === 'head')).toHaveLength(1)
    expect(repo.reads()).toBe(3)

    source.reset()
    await source.list('author')

    expect(repo.calls.filter(call => call === 'head')).toHaveLength(2)
  })

  it('hands out the hash of every file in the commit it reads', async () => {
    const changed = entry('author_1', 'published', '2024-01-01T00:00:00Z', 'Alice')
    const repo = repository({ c1: first, c2: { ...first, '.forgepress/content/author/author_1.ts': changed } })
    const source = createForgeSource(() => repo.forge, defaultPaths)

    expect(await source.hashes.schema()).toBe(repo.shaOf(schema))
    expect(await source.hashes.entry('author', 'author_1')).toBe(repo.shaOf(first['.forgepress/content/author/author_1.ts']!))
    expect(await source.hashes.entry('author', 'author_4')).toBeUndefined()
    expect(await source.hashes.entry('author', '../schema')).toBeUndefined()

    source.reset('c2')

    expect(await source.hashes.entry('author', 'author_1')).toBe(repo.shaOf(changed))
    expect(repo.reads()).toBe(0)
  })

  it('tries again after the forge failed', async () => {
    const repo = repository({ c1: first })
    const source = createForgeSource(() => repo.forge, defaultPaths)

    repo.fail(1)

    await expect(source.list('author')).rejects.toThrow('GitHub 502')
    expect(await source.list('author')).toHaveLength(2)
  })

  it('names the file in the repository when it cannot be parsed', async () => {
    const repo = repository({ c1: { 'apps/site/.forgepress/content/author/author_1.ts': 'export default { id: someId }\n' } })
    const source = createForgeSource(() => repo.forge, defaultPaths, 'apps/site')

    await expect(source.list('author')).rejects.toThrow('[forgepress] apps/site/.forgepress/content/author/author_1.ts:1:22 `someId` is not a literal value')
  })

  it('explains a missing schema and a missing sign-in', async () => {
    const repo = repository({ c1: { '.forgepress/content/author/author_1.ts': first['.forgepress/content/author/author_1.ts']! } })

    await expect(createForgeSource(() => repo.forge, defaultPaths).schema()).rejects.toThrow('[forgepress] .forgepress/schema.ts does not exist in the repository')
    await expect(createForgeSource(() => undefined, defaultPaths).list('author')).rejects.toThrow('[forgepress] sign in to read the content from the repository')
  })
})
