import type { Entry } from '../../src/entries/types'
import type { SchemaChangeset } from '../../src/store/types'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWriter } from '../../src/disk/writer'
import { defaultPaths } from '../../src/files/paths'

const roots: string[] = []

function project() {
  const root = mkdtempSync(join(tmpdir(), 'forgepress-writer-'))

  roots.push(root)

  return { root, writer: createWriter(root) }
}

function row(id: string): Entry {
  return { id, status: 'published', createdAt: '', updatedAt: '' }
}

function change(parts: Partial<SchemaChangeset>): SchemaChangeset {
  return { schema: { collections: { author: { fields: {} } } }, write: [], collections: [], ...parts }
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

  it('removes entries', async () => {
    const { root, writer } = project()

    await writer.writeEntry('hero', row('a'))
    await writer.removeEntry('hero', 'a')

    expect(existsSync(join(root, defaultPaths.entry('hero', 'a')))).toBe(false)
  })

  it('refuses collection names and ids that would leave the content folder', async () => {
    const { root, writer } = project()

    await writer.writeEntry('hero', row('a'))

    await expect(writer.apply(change({ collections: ['../..'] }))).rejects.toThrow('"../.." is not a collection name')
    await expect(writer.removeEntry('hero', '../../schema')).rejects.toThrow('"../../schema" is not an entry id')
    await expect(writer.writeEntry('Hero', row('b'))).rejects.toThrow('"Hero" is not a collection name')
    await expect(writer.writeEntry('hero', row('../../../escaped'))).rejects.toThrow('is not an entry id')
    await expect(writer.apply(change({ write: [{ collection: 'hero', entry: row('b') }, { collection: 'hero', entry: row('../c') }] }))).rejects.toThrow('"../c" is not an entry id')

    expect(readdirSync(join(root, defaultPaths.collection('hero')))).toEqual(['a.ts'])
    expect(readdirSync(root)).toEqual(['.forgepress'])
  })

  it('applies a schema change with its content and says what it wrote', async () => {
    const { root, writer } = project()

    await writer.writeEntry('writer', row('a'))
    await writer.writeEntry('writer', row('b'))

    const files = await writer.apply(change({ collections: ['writer'], write: [{ collection: 'author', entry: row('a') }] }))

    expect(files).toEqual([
      '.forgepress/content/writer/a.ts',
      '.forgepress/content/writer/b.ts',
      '.forgepress/content/author/a.ts',
      '.forgepress/schema.ts',
    ])
    expect(existsSync(join(root, defaultPaths.collection('writer')))).toBe(false)
    expect(readdirSync(join(root, defaultPaths.collection('author')))).toEqual(['a.ts'])
    expect(readFileSync(join(root, defaultPaths.schema), 'utf8')).toContain('author: {')
  })
})
