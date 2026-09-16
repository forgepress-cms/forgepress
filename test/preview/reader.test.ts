// @vitest-environment happy-dom
import type { Changes } from '../../src/changes/types'
import type { Entry } from '../../src/entries/types'
import type { ForgeFile, TokenGetter } from '../../src/forge/types'
import type { OutputIndex, OutputManifest } from '../../src/output/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultPaths } from '../../src/files/paths'
import { serializeEntry, serializeSchema } from '../../src/files/serialize'

const schema: ForgePressSchema = {
  collections: {
    author: { fields: { name: { type: 'text' }, portrait: { type: 'image', optional: true } } },
  },
}

const stored = new Map<string, unknown>()
const blobs = new Map<string, string>()
const commits = new Map<string, Map<string, string>>()
const heads: string[] = []

let head = 'c1'
let tokens: TokenGetter | undefined

vi.doMock('../../src/store', () => ({
  TOKEN_KEY: 'token',
  CHANGES_KEY: 'changes',
  persist: (key: string) => ({
    read: async () => stored.get(key),
    write: async (value: unknown) => void stored.set(key, value),
    clear: async () => void stored.delete(key),
  }),
  repositoryCache: () => undefined,
}))

vi.doMock('../../src/forge', () => ({
  createForge: (_config: unknown, token: TokenGetter) => {
    tokens = token

    return {
      head: async () => {
        await token()
        heads.push(head)

        return head
      },
      files: async (commit: string, directory: string): Promise<ForgeFile[]> => [...commits.get(commit) ?? []]
        .filter(([path]) => path.startsWith(`${directory}/`))
        .map(([path, text]) => {
          blobs.set(`${commit}:${path}`, text)

          return { path, sha: `${commit}:${path}` }
        }),
      read: async (sha: string) => blobs.get(sha)!,
    }
  },
}))

const { createPreviewReader } = await import('../../src/preview/reader')

function author(id: string, name: string, status: Entry['status'], extra: Record<string, unknown> = {}): Entry {
  return { id, status, createdAt: `2024-01-0${id.slice(-1)}T00:00:00Z`, updatedAt: '2024-01-01T00:00:00Z', name, ...extra }
}

function commit(name: string, authors: Entry[]): void {
  commits.set(name, new Map([
    [defaultPaths.schema, serializeSchema(schema)],
    ...authors.map(entry => [defaultPaths.entry('author', entry.id), serializeEntry('author', entry)] as const),
  ]))
}

function reader() {
  return createPreviewReader({ provider: { type: 'forgejo', repository: { owner: 'fred', name: 'site' } }, contentPath: '.forgepress', mediaUrl: '/uploads' })
}

async function authors(files: ReadonlyMap<string, string>): Promise<Record<string, unknown>[]> {
  const index = JSON.parse(files.get('index.json')!) as OutputIndex
  const manifest = JSON.parse(files.get((index.collections.author as { manifest: string }).manifest)!) as OutputManifest

  return manifest.entries.map(entry => JSON.parse(files.get(manifest.files[entry.id]!)!) as Record<string, unknown>)
}

beforeEach(() => {
  stored.clear()
  commits.clear()
  heads.length = 0
  head = 'c1'
  stored.set('token', 'secret')
  commit('c1', [author('author_1', 'Alice', 'published'), author('author_2', 'Bob', 'unpublished')])
})

describe('preview reader', () => {
  it('builds the content output from the repository, unpublished entries included', async () => {
    const files = await reader().build()

    expect((await authors(files)).map(entry => entry.name)).toEqual(['Alice', 'Bob'])
    expect(JSON.parse(files.get('index.json')!)).toMatchObject({ commit: null, locales: [] })
    expect(await tokens!()).toBe('secret')
  })

  it('applies the pending changes of this browser', async () => {
    stored.set('changes', {
      entries: {
        author: {
          author_1: author('author_1', 'Alice Smith', 'published'),
          author_2: null,
          author_3: author('author_3', 'Carol', 'unpublished'),
        },
      },
      uploads: {},
      removed: [],
    } satisfies Changes)

    expect((await authors(await reader().build())).map(entry => entry.name)).toEqual(['Alice Smith', 'Carol'])
  })

  it('shows uploads that aren\'t deployed yet from the browser', async () => {
    let created = 0

    URL.createObjectURL = () => `blob:preview/${created += 1}`
    URL.revokeObjectURL = () => {}

    const upload = (name: string) => ({ name, type: 'image/png', size: 3, modifiedAt: '2024-01-01T00:00:00Z', data: new Uint8Array([1, 2, 3]).buffer })

    commit('c1', [
      author('author_1', 'Alice', 'published', { portrait: { url: '/uploads/alice.1a2b3c4d.png' } }),
      author('author_2', 'Bob', 'unpublished', { portrait: { url: '/uploads/bob.5e6f7a8b.png' } }),
    ])

    stored.set('changes', {
      entries: {},
      uploads: { 'alice.1a2b3c4d.png': upload('alice.1a2b3c4d.png') },
      removed: [],
      publishedMedia: { 'bob.5e6f7a8b.png': upload('bob.5e6f7a8b.png') },
    } satisfies Changes)

    const preview = reader()
    const files = await preview.build()

    expect((await authors(files)).map(entry => entry.portrait)).toEqual([{ url: 'blob:preview/1' }, { url: 'blob:preview/2' }])

    await preview.build()

    expect(created).toBe(2)
  })

  it('leaves out uploads that were deleted in the editor before the site served them', async () => {
    let created = 0

    URL.createObjectURL = () => `blob:preview/${created += 1}`
    URL.revokeObjectURL = () => {}

    const upload = { name: 'bob.5e6f7a8b.png', type: 'image/png', size: 3, modifiedAt: '2024-01-01T00:00:00Z', data: new Uint8Array([1, 2, 3]).buffer }

    commit('c1', [author('author_2', 'Bob', 'unpublished', { portrait: { url: '/uploads/bob.5e6f7a8b.png' } })])

    stored.set('changes', {
      entries: {},
      uploads: {},
      removed: ['bob.5e6f7a8b.png'],
      publishedMedia: { 'bob.5e6f7a8b.png': upload },
    } satisfies Changes)

    expect((await authors(await reader().build())).map(entry => entry.portrait)).toEqual([{ url: '/uploads/bob.5e6f7a8b.png' }])
    expect(created).toBe(0)
  })

  it('reads the head of the branch again for every build', async () => {
    const preview = reader()

    await preview.build()

    head = 'c2'
    commit('c2', [author('author_1', 'Alice', 'published')])

    expect((await authors(await preview.build())).map(entry => entry.name)).toEqual(['Alice'])
    expect(heads).toEqual(['c1', 'c2'])
  })

  it('asks to sign in again when the editor has no token', async () => {
    stored.delete('token')

    await expect(reader().build()).rejects.toThrow('sign in to the editor to preview unpublished content')
  })
})
