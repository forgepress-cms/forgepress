import type { ForgePressSchema } from '../../src/types/schema'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serializeSchema } from '../../src/files/serialize'

interface Case {
  name: string
  code: string
}

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-query-types-test', import.meta.url))

const schema = {
  locales: ['en', 'de'],
  collections: {
    post: {
      fields: {
        title: { type: 'text', translate: true, index: true },
        body: { type: 'richtext', translate: true },
        views: { type: 'number', optional: true },
        cover: { type: 'image', optional: true },
        author: { type: 'relation', collection: 'author', index: true },
        editor: { type: 'relation', collection: 'author', optional: true },
        related: { type: 'relation', collection: 'post', multiple: true, optional: true },
        blocks: { type: 'dynamic', collections: ['hero', 'author'], optional: true },
      },
    },
    author: { fields: { name: { type: 'text' } } },
    hero: { fields: { headline: { type: 'text', translate: true } } },
  },
} as const satisfies ForgePressSchema

const accepted: Case[] = [
  {
    name: 'a translated collection with its locale resolved to plain values',
    code: `const post = await query('post').locale('de').first()
const title: string | undefined = post?.title
const views: number | undefined = post?.views
const author: { collection: 'author', id: string } | undefined = post?.author
const related: { collection: 'post', id: string }[] | undefined = post?.related`,
  },
  {
    name: 'a translated collection without a locale, which fails only when it runs',
    code: `const posts = await query('post')
const ids: string[] = posts.map(post => post.id)`,
  },
  {
    name: 'every operator on the fields it fits',
    code: `await query('post').locale('en')
  .where('title', 'Hello')
  .where('title', 'contains', 'ell')
  .where('title', 'in', ['Hello', 'Hi'])
  .where('views', 'gte', 10)
  .where('views', 'in', [1, 2])
  .where('createdAt', 'lt', '2024-01-01')
  .where('id', 'ne', 'post_1')
  .where('author', 'author_1')
  .where('author', 'in', ['author_1'])
  .where('related', 'contains', 'post_2')
  .where('blocks', 'contains', 'hero_1')
  .sort('views', 'desc')
  .sort('author')
  .offset(1)
  .limit(5)`,
  },
  {
    name: 'relations loaded as entries, optional ones staying optional',
    code: `const post = (await query('post').locale('en').with('author').with('editor').with('related').first())!
const name: string = post.author.name
const editor: string | undefined = post.editor?.name
const titles: string[] | undefined = post.related?.map(item => item.title)`,
  },
  {
    name: 'blocks loaded with their collection to tell them apart',
    code: `const post = (await query('post').locale('en').with('blocks').first())!

for (const block of post.blocks ?? []) {
  const text: string = block.collection === 'hero' ? block.entry.headline : block.entry.name
}`,
  },
  {
    name: 'picked fields only',
    code: `const [post] = await query('post').locale('en').with('author').pick('id', 'author')
const name: string | undefined = post?.author.name`,
  },
]

const rejected: Case[] = [
  { name: 'an unknown collection', code: `await query('page')` },
  { name: 'a locale the site does not have', code: `await query('post').locale('fr')` },
  { name: 'a status, which the output does not have', code: `const post = await query('post').locale('en').first()\nconst status = post?.status` },
  { name: 'a range on text', code: `await query('post').locale('en').where('title', 'gt', 'A')` },
  { name: 'contains on a number', code: `await query('post').locale('en').where('views', 'contains', 1)` },
  { name: 'a value of the wrong type', code: `await query('post').locale('en').where('views', '10')` },
  { name: 'a relation compared with something else than an id', code: `await query('post').locale('en').where('author', 'eq', 1)` },
  { name: 'equality on a list of links', code: `await query('post').locale('en').where('related', 'post_1')` },
  { name: 'filtering by media', code: `await query('post').locale('en').where('cover', 'eq', 'a.png')` },
  { name: 'sorting by blocks', code: `await query('post').locale('en').sort('blocks')` },
  { name: 'loading a field that does not link', code: `await query('post').locale('en').with('title')` },
  { name: 'a field that was not picked', code: `const [post] = await query('post').locale('en').pick('id')\nconst title = post?.title` },
]

const cases = [...accepted, ...rejected]
const errors = new Map<string, string[]>()

function file(index: number): string {
  return join(scratch, `case-${index}.ts`)
}

beforeAll(() => {
  mkdirSync(scratch, { recursive: true })
  writeFileSync(join(scratch, 'schema.ts'), serializeSchema(schema).replace('from \'forgepress\'', 'from \'../../src/types/schema\''))

  cases.forEach((item, index) => writeFileSync(file(index), [
    'import type { Query } from \'../../src/query/types\'',
    'import type schema from \'./schema\'',
    '',
    'declare const query: Query<typeof schema>',
    '',
    'export async function check(): Promise<void> {',
    ...item.code.split('\n').map(line => `  ${line}`),
    '}',
    '',
  ].join('\n')))

  const program = ts.createProgram([join(scratch, 'schema.ts'), ...cases.map((_, index) => file(index))], {
    strict: true,
    exactOptionalPropertyTypes: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts'],
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  })

  cases.forEach((_, index) => {
    const source = program.getSourceFile(file(index))!
    const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]

    errors.set(file(index), diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')))
  })
}, 60_000)

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

describe('query types', () => {
  it.each(accepted.map(item => [item.name, cases.indexOf(item)] as const))('accept %s', (_, index) => {
    expect(errors.get(file(index))).toEqual([])
  })

  it.each(rejected.map(item => [item.name, cases.indexOf(item)] as const))('reject %s', (_, index) => {
    expect(errors.get(file(index))).not.toEqual([])
  })
})
