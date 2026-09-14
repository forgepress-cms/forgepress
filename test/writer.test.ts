import type { ContentRow } from '../src/types/entry'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWriter } from '../src/disk/writer'
import { defaultPaths } from '../src/files/paths'

const roots: string[] = []

function project() {
  const root = mkdtempSync(join(tmpdir(), 'forgepress-writer-'))

  roots.push(root)

  return { root, writer: createWriter(root) }
}

function row(id: string): ContentRow {
  return { id, status: 'published', createdAt: '', updatedAt: '' }
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('node writer', () => {
  it('writes one file per entry and nothing else', async () => {
    const { root, writer } = project()

    await writer.writeEntry('blogPost', row('a'))
    await writer.writeEntry('blogPost', row('b'))

    expect(readdirSync(join(root, defaultPaths.collection('blogPost'))).sort()).toEqual(['a.ts', 'b.ts'])
  })

  it('removes entries and whole collections', async () => {
    const { root, writer } = project()

    await writer.writeEntry('hero', row('a'))
    await writer.removeEntry('hero', 'a')

    expect(existsSync(join(root, defaultPaths.entry('hero', 'a')))).toBe(false)

    await writer.writeEntry('hero', row('b'))
    await writer.removeCollection('hero')

    expect(existsSync(join(root, defaultPaths.collection('hero')))).toBe(false)
  })

  it('refuses collection names and ids that would leave the content folder', async () => {
    const { root, writer } = project()

    await writer.writeEntry('hero', row('a'))

    await expect(writer.removeCollection('../..')).rejects.toThrow('"../.." is not a collection name')
    await expect(writer.removeEntry('hero', '../../schema')).rejects.toThrow('"../../schema" is not an entry id')
    await expect(writer.writeEntry('Hero', row('b'))).rejects.toThrow('"Hero" is not a collection name')
    await expect(writer.writeEntry('hero', row('../../../escaped'))).rejects.toThrow('is not an entry id')
    await expect(writer.writeContent('hero', [row('b'), row('../c')])).rejects.toThrow('"../c" is not an entry id')

    expect(readdirSync(join(root, defaultPaths.collection('hero')))).toEqual(['a.ts'])
    expect(readdirSync(root)).toEqual(['.forgepress'])
  })

  it('replaces a collection, deleting entries that are gone', async () => {
    const { root, writer } = project()

    await writer.writeEntry('hero', row('a'))
    await writer.writeContent('hero', [row('b')])

    expect(readdirSync(join(root, defaultPaths.collection('hero')))).toEqual(['b.ts'])
  })
})
