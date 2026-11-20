import { globSync, readdirSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { LAYERS, NODE } from './architecture'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const VIRTUAL = ['src/fresh/index.ts', 'src/schema/fields/index.ts', 'editor/pages/content/index.vue.ts']
const eslint = new ESLint({ cwd: ROOT, overrideConfig: { languageOptions: { parserOptions: { projectService: { allowDefaultProject: VIRTUAL } } } } })

async function messages(file: string, code: string): Promise<ESLint.LintResult['messages']> {
  const [result] = await eslint.lintText(`${code}\n`, { filePath: `${ROOT}${file}` })

  return (result?.messages ?? []).filter(message => message.ruleId === null || message.ruleId.startsWith('forgepress/'))
}

async function lint(file: string, code: string): Promise<string[]> {
  return (await messages(file, code)).map(message => message.messageId ?? message.message)
}

function modules(area: string): string[] {
  return readdirSync(`${ROOT}${area}`, { withFileTypes: true })
    .filter(entry => entry.isDirectory() ? entry.name !== 'node_modules' : /\.(?:ts|vue|css)$/.test(entry.name) && !/\.(?:d|test)\.ts$/.test(entry.name))
    .map(entry => entry.name.replace(/\.(?:ts|vue|css)$/, ''))
}

function isCode(file: string): boolean {
  return /\.(?:ts|vue|mjs)$/.test(file) && !/\.(?:d|test)\.ts$/.test(file)
}

function nameOf(file: string): string {
  return basename(file).replace(/\.test\.ts$|\.(?:ts|vue|mjs)$/, '')
}

function testFiles(): string[] {
  return ['src', 'editor', 'scripts', 'test'].flatMap(area => globSync(`${area}/**/*.test.ts`, { cwd: ROOT, exclude: ['**/node_modules/**'] }))
}

function moduleOf(file: string): string {
  const parts = file.split('/')

  return parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0] ?? ''
}

function filesOf(module: string): string[] {
  return module.includes('/') ? globSync(`${module}/**/*`, { cwd: ROOT }) : readdirSync(`${ROOT}${module}`).map(name => `${module}/${name}`)
}

describe('forgepress/layers', () => {
  it('lets a module import the layers below it, packages and its own files', async () => {
    expect(await lint('src/files/check.ts', `import { isEntryId } from '../entries'\nimport { parseFile } from './parse'\nimport { h } from 'vue'`)).toEqual([])
  })

  it('reports imports, re-exports and dynamic imports of a higher layer', async () => {
    expect(await lint('src/schema/validate.ts', `import { toEntryRef } from '../files'`)).toEqual(['upward'])
    expect(await lint('src/schema/validate.ts', `export { createOutput } from '../output'`)).toEqual(['upward'])
    expect(await lint('src/schema/validate.ts', `export const load = () => import('../output')`)).toEqual(['upward'])
  })

  it('lets the editor build on src, but not the other way round', async () => {
    expect(await lint('editor/pages/routes.ts', `import { isEntryId } from '../../src/entries'`)).toEqual([])
    expect(await lint('src/forge/create.ts', `export { mountEditor } from '../../editor/mount'`)).toEqual(['area'])
  })

  it('keeps the editor in its own order', async () => {
    expect(await lint('editor/utils/entry.ts', `import { useContent } from '../composables'`)).toEqual(['upward'])
    expect(await lint('editor/mount.ts', `import styles from './styles.css?inline'`)).toEqual([])
  })

  it('keeps Node out of code that also runs in the browser', async () => {
    expect(await lint('src/schema/validate.ts', `import { readFile } from 'node:fs/promises'`)).toEqual(['builtin'])
    expect(await lint('src/index.ts', `export { buildOutput } from './disk'`)).toEqual(['node'])
    expect(await lint('editor/settings.ts', `import { findRoot } from '../src/disk'`)).toEqual(['node'])
    expect(await lint('src/disk/files.ts', `import { readFile } from 'node:fs/promises'`)).toEqual([])
    expect(await lint('src/cli/commands.ts', `import { buildOutput } from '../disk'`)).toEqual([])
  })

  it('asks for a place for a module that isn\'t in the layers', async () => {
    expect(await lint('src/fresh/index.ts', `export { fresh } from './fresh'`)).toEqual(['unknown'])
    expect(await lint('src/cli/commands.ts', `import { fresh } from '../fresh'`)).toEqual(['unknown'])
  })

  it('lists exactly the modules that exist', () => {
    expect([...LAYERS.src].sort()).toEqual(modules('src').sort())
    expect([...LAYERS.editor].sort()).toEqual(modules('editor').sort())
    expect(NODE.src.every(module => (LAYERS.src as readonly string[]).includes(module))).toBe(true)
  })

  it('names folders in kebab-case', () => {
    const folders = ['src', 'editor'].flatMap(area => globSync(`${area}/**/`, { cwd: ROOT, exclude: ['**/node_modules/**'] }))

    expect(folders.filter(folder => !/^[a-z\d]+(?:-[a-z\d]+)*$/.test(folder.replace(/\/$/, '').split('/').pop() ?? ''))).toEqual([])
  })

  it('keeps tests next to the code they test, and only the type tests in test/', () => {
    const tests = testFiles()

    expect(tests.filter(test => test.startsWith('test/') && !test.startsWith('test/types/'))).toEqual([])
    expect(tests.filter(test => !test.startsWith('test/') && !readdirSync(`${ROOT}${dirname(test)}`).some(isCode))).toEqual([])
  })

  it('keeps a test next to the file it is named after', () => {
    const misplaced = testFiles().filter((test) => {
      const namesakes = filesOf(moduleOf(test)).filter(file => isCode(file) && nameOf(file) === nameOf(test))

      return namesakes.length > 0 && !namesakes.some(file => dirname(file) === dirname(test))
    })

    expect(misplaced).toEqual([])
  })
})

describe('forgepress/entries', () => {
  it('lets other modules in only through the index.ts', async () => {
    expect(await lint('src/files/check.ts', `import type { Schema } from '../schema'`)).toEqual([])
    expect(await lint('src/files/check.ts', `import type { Schema } from '../schema/types'`)).toEqual(['entry'])
    expect(await lint('src/files/check.ts', `import { fieldTypes } from '../schema/fields/registry'`)).toEqual(['entry'])
    expect(await lint('src/files/check.ts', `import { once } from '../utils/index'`)).toEqual(['entry'])
    expect(await lint('editor/settings.ts', `import { createPaths } from '../src/files/paths'`)).toEqual(['entry'])
  })

  it('names the import to use instead', async () => {
    const [message] = await messages('editor/plugins/router.ts', `import { createPaths } from '../../src/files/paths'`)

    expect(message?.message).toContain('\'../../src/files\'')
  })

  it('keeps files of a module from importing their own index.ts', async () => {
    expect(await lint('src/schema/validate.ts', `import { fieldTypes } from './fields/registry'`)).toEqual([])
    expect(await lint('src/schema/validate.ts', `import { fieldTypes } from '.'`)).toEqual(['own'])
    expect(await lint('src/schema/validate.ts', `import { fieldTypes } from './index'`)).toEqual(['own'])
    expect(await lint('src/schema/fields/text.ts', `import type { Schema } from '..'`)).toEqual(['own'])
    expect(await lint('src/schema/fields/text.ts', `import type { Schema } from '../../schema'`)).toEqual(['own'])
  })

  it('lets an index.ts only re-export the files of its module by name', async () => {
    expect(await lint('src/schema/index.ts', `export type { Schema } from './types'\nexport { fieldTypes } from './fields/registry'`)).toEqual([])
    expect(await lint('src/schema/index.ts', `export const schema = 1`)).toEqual(['reexport'])
    expect(await lint('src/schema/index.ts', `import { fieldTypes } from './fields/registry'\nexport { fieldTypes }`)).toEqual(['reexport', 'reexport'])
    expect(await lint('src/schema/index.ts', `export * from './types'`)).toEqual(['star'])
    expect(await lint('src/query/index.ts', `export { isPage } from '../utils'`)).toEqual(['reexport'])
    expect(await lint('src/index.ts', `export { query } from './query'`)).toEqual([])
    expect(await lint('src/index.ts', `export const version = 1`)).toEqual(['reexport'])
  })

  it('keeps index.ts out of the subfolders of a module', async () => {
    expect(await lint('src/schema/fields/index.ts', `export { fieldTypes } from './registry'`)).toEqual(['nested'])
    expect(await lint('editor/pages/content/index.vue.ts', `export const page = 1`)).toEqual([])
  })
})
