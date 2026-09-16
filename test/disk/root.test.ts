import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findRoot } from '../../src/disk/root'

let scratch: string | undefined

function project(files: string[]): string {
  scratch = mkdtempSync(join(tmpdir(), 'forgepress-root-'))

  for (const file of files) {
    mkdirSync(join(scratch, file, '..'), { recursive: true })
    writeFileSync(join(scratch, file), '')
  }

  return scratch
}

afterEach(() => {
  if (scratch)
    rmSync(scratch, { recursive: true, force: true })

  scratch = undefined
})

describe('findRoot', () => {
  it('walks up to the folder with the config file', () => {
    const root = project(['package.json', 'site/forgepress.config.mjs', 'site/src/pages/index.vue'])

    expect(findRoot(join(root, 'site/src/pages'))).toBe(join(root, 'site'))
  })

  it('walks up to the folder with a TypeScript config file', () => {
    const root = project(['package.json', 'site/forgepress.config.ts', 'site/src/pages/index.vue'])

    expect(findRoot(join(root, 'site/src/pages'))).toBe(join(root, 'site'))
  })

  it('walks up to the folder with the schema', () => {
    const root = project(['.forgepress/schema.ts', '.forgepress/content/author/author_1.ts'])

    expect(findRoot(join(root, '.forgepress/content/author'))).toBe(root)
  })

  it('looks for the schema in the content folder it is given', () => {
    const root = project(['package.json', 'site/cms/schema.ts', 'site/.forgepress/schema.ts'])

    expect(findRoot(join(root, 'site/src'), 'cms')).toBe(join(root, 'site'))
    expect(findRoot(join(root, 'site/src'), 'content')).toBe(root)
  })

  it('does not stop at a content folder holding only the generated types', () => {
    const root = project(['package.json', 'app/.forgepress/forgepress.d.ts', 'app/app.vue'])

    expect(findRoot(join(root, 'app'))).toBe(root)
  })

  it('falls back to the nearest package, like a Nuxt project whose Vite root is app/', () => {
    const root = project(['package.json', 'app/app.vue'])

    expect(findRoot(join(root, 'app'))).toBe(root)
  })

  it('stops at the nearest package, even below a folder with a config file or a schema', () => {
    const root = project(['package.json', 'forgepress.config.mjs', '.forgepress/schema.ts', 'playgrounds/site/package.json', 'playgrounds/site/app/app.vue'])

    expect(findRoot(join(root, 'playgrounds/site/app'))).toBe(join(root, 'playgrounds/site'))
    expect(findRoot(join(root, 'playgrounds'))).toBe(root)
  })

  it('falls back to where it started outside any package', () => {
    const root = project(['app/app.vue'])

    expect(findRoot(join(root, 'app'))).toBe(join(root, 'app'))
  })
})
