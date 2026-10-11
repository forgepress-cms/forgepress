import type { Schema } from '../../src/schema/types'
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
} as const satisfies Schema

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
    code: `const post = (await query('post').locale('en').with('author', 'editor', 'related').first())!
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
    name: 'several paths, each loading its own field',
    code: `const post = (await query('post').locale('en').with('author.posts', 'blocks').first())!
const name: string = post.author.name
const posts: number = post.author.posts?.length ?? 0
const headline: string | undefined = post.blocks?.map(block => block.collection === 'hero' ? block.entry.headline : block.entry.name)[0]`,
  },
  {
    name: 'picked fields of the entries a field loads, per collection',
    code: `const post = (await query('post').locale('en').with('author', 'blocks', { hero: ['headline'], author: ['id', 'name'] }).first())!
const name: string = post.author.name
const texts: string[] = post.blocks?.map(block => block.collection === 'hero' ? block.entry.headline : block.entry.id) ?? []`,
  },
  {
    name: 'picked fields inside component items and along a path',
    code: `const post = (await query('post').locale('en').with('mixed', 'author.posts', { author: ['name', 'posts'], post: ['title'] }).first())!
const names: (string | undefined)[] = post.mixed?.map(item => item.component === 'card' ? item.link?.name : undefined) ?? []
const titles: string[] = post.author.posts?.map(item => item.title) ?? []`,
  },
  {
    name: 'several paths under the same field, each one loaded',
    code: `const post = (await query('post').locale('en').with('related.author', 'related.editor', 'related.blocks').first())!
const author: string | undefined = post.related?.[0]?.author.name
const editor: string | undefined = post.related?.[0]?.editor?.name
const texts: string[] = post.related?.[0]?.blocks?.map(block => block.collection === 'hero' ? block.entry.headline : block.entry.name) ?? []`,
  },
  {
    name: 'a query as the collection type it returns',
    code: `const plain = await query('post').locale('en').first()
const loaded = (await query('post').locale('en').with('author.posts', 'blocks', { author: ['name', 'posts'] }).first())!
const one: Same<typeof plain, Collection<'post'> | undefined> = true
const two: Same<typeof loaded, Collection<'post', With<'author.posts' | 'blocks', { author: ['name', 'posts'] }>>> = true
const listed: Collection<'post', With<'author'>>[] = await query('post').locale('en').with('author')`,
  },
  {
    name: 'picked fields as a Pick of the collection type, before or after loading',
    code: `const picked = (await query('post').locale('en').pick('id', 'title').first())!
const after = (await query('post').locale('en').with('author').pick('title', 'author').first())!
const before = (await query('post').locale('en').pick('title', 'author').with('author').first())!
const one: Same<typeof picked, Pick<Collection<'post'>, 'id' | 'title'>> = true
const two: Same<typeof after, Pick<Collection<'post', With<'author'>>, 'title' | 'author'>> = true
const three: Same<typeof before, typeof after> = true`,
  },
  {
    name: 'a component by its name, with links as references until a path loads them',
    code: `const stored = {} as Component<'card'>
const loaded = {} as Component<'card', With<'link'>>
const deeper = {} as Component<'card', With<'link.posts'>>
const kept = {} as Component<'card', With<'link', { author: ['name'] }>>
const ref: { collection: 'author', id: string } | undefined = stored.link
const posts: { collection: 'post', id: string }[] | undefined = loaded.link?.posts
const titles: string[] | undefined = deeper.link?.posts?.map(item => item.title)
const name: string | undefined = kept.link?.name
const title: string = kept.title`,
  },
  {
    name: 'a component item of a query as the component type it declares',
    code: `const post = (await query('post').locale('en').with('cards', 'mixed', { author: ['name'] }).first())!
const card: Component<'card', With<'link', { author: ['name'] }>> | undefined = post.cards?.[0]
const quotes: Component<'quote', With<'source', { author: ['name'] }>>[] = post.mixed?.flatMap(item => item.component === 'quote' ? [item] : []) ?? []
const same: Same<NonNullable<typeof post.cards>[number], Component<'card', With<'link', { author: ['name'] }>>> = true`,
  },
  {
    name: 'a collection with paths, a union of them, and the fields to keep',
    code: `const post = {} as Collection<'post', With<'author.posts' | 'spot', { hero: ['headline'] }>>
const titles: string[] | undefined = post.author.posts?.map(item => item.title)
const text: string = post.spot === undefined ? '' : post.spot.collection === 'hero' ? post.spot.entry.headline : post.spot.entry.name
const editor: { collection: 'author', id: string } | undefined = post.editor`,
  },
  {
    name: 'a stored entry, the locales of the site, and the untyped forms',
    code: `const stored = {} as Content<'post'>
const title: string = stored.title.de
const locale: Locale = 'de'
const anyStored = {} as Content
const status: 'published' | 'unpublished' = anyStored.status
const anyEntry = {} as Collection
const id: string = anyEntry.id
const field: unknown = anyEntry.title
const anyItem = {} as Component
const value: unknown = anyItem.title`,
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
  { name: 'a field of a loaded entry that was not picked', code: `const post = (await query('post').locale('en').with('author', { author: ['name'] }).first())!\nconst id = post.author.id` },
  { name: 'picking a field the collection does not have', code: `await query('post').locale('en').with('author', { author: ['title'] })` },
  { name: 'picking from a collection that does not exist', code: `await query('post').locale('en').with('author', { writer: ['name'] })` },
  { name: 'a field of a kept component link that was not kept', code: `const card = {} as Component<'card', With<'link', { author: ['name'] }>>\nconst id = card.link?.id` },
  { name: 'a loaded field on a component as it is stored', code: `const card = {} as Component<'card'>\nconst name = card.link?.name` },
  { name: 'a second call to with', code: `await query('post').locale('en').with('author').with('blocks')` },
  { name: 'a second call to pick', code: `await query('post').locale('en').pick('id', 'title').pick('id')` },
  { name: 'a field list before the paths', code: `await query('post').locale('en').with({ author: ['name'] }, 'author')` },
  { name: 'a field list without a path', code: `await query('post').locale('en').with({ author: ['name'] })` },
  { name: 'With without what it loads', code: `const post = {} as Collection<'post', With>` },
  { name: 'With for a field that does not link', code: `const post = {} as Collection<'post', With<'title'>>` },
  { name: 'With for a path of another collection', code: `const hero = {} as Collection<'hero', With<'author'>>` },
  { name: 'With keeping a field the collection does not have', code: `const post = {} as Collection<'post', With<'author', { author: ['title'] }>>` },
  { name: 'With for a path the component does not have', code: `const card = {} as Component<'card', With<'author'>>` },
  { name: 'a field of a loaded entry that the declared type does not keep', code: `const post = {} as Collection<'post', With<'author', { author: ['name'] }>>\nconst id = post.author.id` },
  { name: 'a query that loads more than the declared type', code: `const post: Collection<'post'> | undefined = await query('post').locale('en').with('author').first()` },
  { name: 'a query that loads less than the declared type', code: `const post: Collection<'post', With<'author' | 'editor'>> | undefined = await query('post').locale('en').with('author').first()` },
  { name: 'a collection that does not exist', code: `const page = {} as Collection<'page'>` },
  { name: 'a component that does not exist', code: `const grid = {} as Component<'grid'>` },
]

const cases = [...accepted, ...rejected]
const errors = new Map<string, string[]>()

function file(index: number): string {
  return join(scratch, `case-${index}.ts`)
}

beforeAll(() => {
  mkdirSync(scratch, { recursive: true })
  writeFileSync(join(scratch, 'schema.ts'), serializeSchema(schema).replace('from \'forgepress\'', 'from \'../../src/schema/types\''))

  writeFileSync(join(scratch, 'registry.ts'), [
    'import type schema from \'./schema\'',
    '',
    'declare module \'../../src/schema/types\' {',
    '  interface SchemaRegistry {',
    '    schema: typeof schema',
    '  }',
    '}',
    '',
    'export {}',
    '',
  ].join('\n'))

  cases.forEach((item, index) => writeFileSync(file(index), [
    'import type { Collection, Component, Content, Locale, With } from \'../../src/entries/types\'',
    'import type { Query } from \'../../src/query/types\'',
    'import type schema from \'./schema\'',
    '',
    'type Same<TLeft, TRight> = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false',
    '',
    'declare const query: Query<typeof schema>',
    '',
    'export async function check(): Promise<void> {',
    ...item.code.split('\n').map(line => `  ${line}`),
    '}',
    '',
  ].join('\n')))

  const program = ts.createProgram([join(scratch, 'schema.ts'), join(scratch, 'registry.ts'), ...cases.map((_, index) => file(index))], {
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
