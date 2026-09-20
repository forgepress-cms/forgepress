import type { ForgePressSchema } from '../../src/schema/types'
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
  components: {
    card: { fields: { title: { type: 'text' }, link: { type: 'collection', collections: ['author'], optional: true } } },
    quote: { fields: { saying: { type: 'text' }, source: { type: 'collection', collections: ['author', 'hero'], optional: true } } },
  },
  collections: {
    post: {
      fields: {
        title: { type: 'text', translate: true, index: true },
        body: { type: 'richtext', translate: true },
        views: { type: 'number', optional: true },
        featured: { type: 'boolean' },
        stage: { type: 'list', values: ['draft', 'final'], optional: true },
        tags: { type: 'list', values: ['news', 'guide'], multiple: true, optional: true },
        cover: { type: 'image', optional: true },
        author: { type: 'collection', collections: ['author'], index: true },
        editor: { type: 'collection', collections: ['author'], optional: true },
        related: { type: 'collection', collections: ['post'], multiple: true, optional: true },
        blocks: { type: 'collection', collections: ['hero', 'author'], multiple: true, optional: true },
        cards: { type: 'component', components: ['card'], multiple: true, translate: true, optional: true },
        mixed: { type: 'component', components: ['card', 'quote'], multiple: true, optional: true },
        spot: { type: 'collection', collections: ['hero', 'author'], optional: true, index: true },
      },
    },
    author: { fields: { name: { type: 'text' }, posts: { type: 'collection', collections: ['post'], multiple: true, optional: true } } },
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
  .where('featured', true)
  .where('stage', 'final')
  .where('stage', 'in', ['draft', 'final'])
  .where('tags', 'contains', 'news')
  .where('featured', 'ne', false)
  .where('createdAt', 'lt', '2024-01-01')
  .where('id', 'ne', 'post_1')
  .where('author', 'author_1')
  .where('author', 'in', ['author_1'])
  .where('related', 'contains', 'post_2')
  .where('blocks', 'contains', 'hero_1')
  .where('spot', 'hero_1')
  .where('spot', 'in', ['hero_1', 'author_1'])
  .sort('views', 'desc')
  .sort('author')
  .sort('featured')
  .sort('stage')
  .sort('spot')
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
    name: 'component items with their fields and references',
    code: `const post = await query('post').locale('en').first()
const title: string | undefined = post?.cards?.[0]?.title
const link: { collection: 'author', id: string } | undefined = post?.cards?.[0]?.link`,
  },
  {
    name: 'one entry of several collections, loaded with the collection it came from',
    code: `const post = (await query('post').locale('en').with('spot').first())!
const spot = post.spot
const text: string = spot === undefined ? '' : spot.collection === 'hero' ? spot.entry.headline : spot.entry.name`,
  },
  {
    name: 'items of several components, told apart by their component',
    code: `const post = (await query('post').locale('en').first())!

for (const item of post.mixed ?? []) {
  const text: string = item.component === 'card' ? item.title : item.saying
}`,
  },
  {
    name: 'links inside component items loaded with the item',
    code: `const post = (await query('post').locale('en').with('cards').first())!
const name: string | undefined = post.cards?.[0]?.link?.name`,
  },
  {
    name: 'links inside items of several components, told apart by their component',
    code: `const post = (await query('post').locale('en').with('mixed').first())!

for (const item of post.mixed ?? []) {
  if (item.component === 'quote') {
    const source = item.source
    const text: string = source === undefined ? item.saying : source.collection === 'author' ? source.entry.name : source.entry.headline
  }
  else {
    const text: string = item.link?.name ?? item.title
  }
}`,
  },
  {
    name: 'picked fields only',
    code: `const [post] = await query('post').locale('en').with('author').pick('id', 'author')
const name: string | undefined = post?.author.name`,
  },
  {
    name: 'a path that follows a link inside the entry it loaded',
    code: `const post = (await query('post').locale('en').with('author.posts').first())!
const title: string | undefined = post.author.posts?.[0]?.title`,
  },
  {
    name: 'a path through component items into the entries they point at',
    code: `const post = (await query('post').locale('en').with('cards.link.posts').first())!
const titles: string[] = post.cards?.[0]?.link?.posts?.map(item => item.title) ?? []`,
  },
  {
    name: 'a path that only one of the collections a field names has',
    code: `const post = (await query('post').locale('en').with('blocks.posts').first())!
const titles: string[] = post.blocks?.flatMap(block => block.collection === 'author' ? block.entry.posts?.map(item => item.title) ?? [] : [block.entry.headline]) ?? []`,
  },
  {
    name: 'several calls, each loading its own field',
    code: `const post = (await query('post').locale('en').with('author.posts').with('blocks').first())!
const name: string = post.author.name
const posts: number = post.author.posts?.length ?? 0
const headline: string | undefined = post.blocks?.map(block => block.collection === 'hero' ? block.entry.headline : block.entry.name)[0]`,
  },
]

const rejected: Case[] = [
  { name: 'an unknown collection', code: `await query('page')` },
  { name: 'a locale the site does not have', code: `await query('post').locale('fr')` },
  { name: 'a status, which the output does not have', code: `const post = await query('post').locale('en').first()\nconst status = post?.status` },
  { name: 'a range on text', code: `await query('post').locale('en').where('title', 'gt', 'A')` },
  { name: 'contains on a number', code: `await query('post').locale('en').where('views', 'contains', 1)` },
  { name: 'a value of the wrong type', code: `await query('post').locale('en').where('views', '10')` },
  { name: 'contains on a single list value', code: `await query('post').locale('en').where('stage', 'contains', 'dr')` },
  { name: 'a list value typed as something else', code: `const post = await query('post').locale('en').first()\nconst stage: 'draft' | undefined = post?.stage` },
  { name: 'a range on a boolean', code: `await query('post').locale('en').where('featured', 'gt', false)` },
  { name: 'a relation compared with something else than an id', code: `await query('post').locale('en').where('author', 'eq', 1)` },
  { name: 'equality on a list of links', code: `await query('post').locale('en').where('related', 'post_1')` },
  { name: 'filtering by media', code: `await query('post').locale('en').where('cover', 'eq', 'a.png')` },
  { name: 'sorting by blocks', code: `await query('post').locale('en').sort('blocks')` },
  { name: 'filtering by a component', code: `await query('post').locale('en').where('cards', 'eq', 'x')` },
  { name: 'a component field that does not exist', code: `const post = await query('post').locale('en').first()\nconst colour = post?.cards?.[0]?.colour` },
  { name: 'loading a field that does not link', code: `await query('post').locale('en').with('title')` },
  { name: 'a path through a field that does not link', code: `await query('post').locale('en').with('author.name')` },
  { name: 'a path into a component field that does not exist', code: `await query('post').locale('en').with('cards.writer')` },
  { name: 'a field that was not picked', code: `const [post] = await query('post').locale('en').pick('id')\nconst title = post?.title` },
]

const cases = [...accepted, ...rejected]
const errors = new Map<string, string[]>()

function file(index: number): string {
  return join(scratch, `case-${index}.ts`)
}

beforeAll(() => {
  mkdirSync(scratch, { recursive: true })
  writeFileSync(join(scratch, 'schema.ts'), serializeSchema(schema).replace('from \'forgepress\'', 'from \'../../src/schema/types\''))

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
