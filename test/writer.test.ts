import type { ContentRow } from '../src/types/content/reader'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultPaths } from '../src/content/paths'
import { createWriter } from '../src/content/writer/node'

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

  it('replaces a collection, deleting entries that are gone', async () => {
    const { root, writer } = project()

    await writer.writeEntry('hero', row('a'))
    await writer.writeContent('hero', [row('b')])

    expect(readdirSync(join(root, defaultPaths.collection('hero')))).toEqual(['b.ts'])
  })
})
