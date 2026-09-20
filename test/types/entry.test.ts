import type { ForgePressSchema } from '../../src/schema/types'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateEntry } from '../../src/entries/validate'
import { parseEntry, parseSchema } from '../../src/files/parse'
import { serializeSchema } from '../../src/files/serialize'

interface Case {
  name: string
  entry: Record<string, unknown>
}

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-types-test', import.meta.url))

const schema = {
  locales: ['en', 'de'],
  components: {
    card: { fields: { title: { type: 'text' }, wide: { type: 'boolean' }, link: { type: 'collection', collections: ['post'], optional: true } } },
    quote: { fields: { saying: { type: 'text' } } },
  },
  collections: {
    post: {
      fields: {
        title: { type: 'text', translate: true },
        summary: { type: 'text', translate: true, optional: true },
        body: { type: 'richtext' },
        slug: { type: 'text', validation: '^[a-z-]+$', optional: true, index: true },
        rating: { type: 'number', min: 0, max: 5, step: 0.5, optional: true, index: true },
        cover: { type: 'image', optional: true },
        gallery: { type: 'image', multiple: true, optional: true },
        teaser: { type: 'video', optional: true },
        author: { type: 'collection', collections: ['author'], index: true },
        related: { type: 'collection', collections: ['post'], multiple: true, optional: true },
        blocks: { type: 'collection', collections: ['hero', 'author'], multiple: true, optional: true },
        cards: { type: 'component', components: ['card'], multiple: true, translate: true, optional: true },
        feature: { type: 'component', components: ['card'], optional: true },
        mixed: { type: 'component', components: ['card', 'quote'], multiple: true, optional: true },
        spot: { type: 'collection', collections: ['hero', 'author'], optional: true },
        stage: { type: 'list', values: ['draft', 'final'], optional: true },
        tags: { type: 'list', values: ['news', 'guide'], multiple: true, optional: true },
      },
    },
    author: { fields: { name: { type: 'text' } } },
    hero: { fields: { headline: { type: 'text' } } },
  },
} as const satisfies ForgePressSchema

const post: Record<string, unknown> = {
  id: 'post_1',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  title: { en: 'Hello', de: 'Hallo' },
  body: 'Text',
  author: 'author_1',
}

function without(key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(post).filter(([name]) => name !== key))
}

function change(fields: Record<string, unknown>): Record<string, unknown> {
  return { ...post, ...fields }
}

const accepted: Case[] = [
  { name: 'a complete entry', entry: post },
  {
    name: 'every optional field',
    entry: change({
      summary: { en: 'Short' },
      slug: 'hello-world',
      rating: 4.5,
      cover: { url: '/uploads/a.png', alt: 'A', width: 800, height: 600 },
      gallery: [{ url: '/uploads/a.png' }],
      teaser: { url: '/uploads/a.mp4' },
      related: ['post_2'],
      blocks: [{ collection: 'hero', id: 'hero_1' }, { collection: 'author', id: 'author_1' }],
      cards: { en: [{ title: 'One', wide: false, link: 'post_2' }], de: [] },
      feature: { title: 'Big', wide: true },
      stage: 'final',
      tags: ['guide', 'news'],
      mixed: [{ component: 'card', title: 'One', wide: true }, { component: 'quote', saying: 'Hi' }],
      spot: { collection: 'author', id: 'author_1' },
    }),
  },
  { name: 'an empty required text', entry: change({ body: '' }) },
  { name: 'an optional translation without values', entry: change({ summary: {} }) },
  { name: 'an optional translation in one locale', entry: change({ summary: { de: 'Kurz' } }) },
  { name: 'empty lists', entry: change({ gallery: [], related: [], blocks: [] }) },
]

const rejected: Case[] = [
  { name: 'a missing required field', entry: without('body') },
  { name: 'a missing translation', entry: change({ title: { en: 'Hello' } }) },
  { name: 'an unknown locale', entry: change({ title: { en: 'Hello', de: 'Hallo', fr: 'Bonjour' } }) },
  { name: 'a translated field without locales', entry: change({ title: 'Hello' }) },
  { name: 'an unknown field', entry: change({ colour: 'red' }) },
  { name: 'text as a number', entry: change({ body: 1 }) },
  { name: 'text as a boolean', entry: change({ body: true }) },
  { name: 'a number as text', entry: change({ rating: '4' }) },
  { name: 'media without a url', entry: change({ cover: { alt: 'A' } }) },
  { name: 'media with an unknown option', entry: change({ cover: { url: '/a.png', caption: 'A' } }) },
  { name: 'media with a text width', entry: change({ cover: { url: '/a.png', width: '800' } }) },
  { name: 'a single media as a list', entry: change({ cover: [{ url: '/a.png' }] }) },
  { name: 'a media list as a single media', entry: change({ gallery: { url: '/a.png' } }) },
  { name: 'a single relation as a list', entry: change({ author: ['author_1'] }) },
  { name: 'a relation list as a single id', entry: change({ related: 'post_2' }) },
  { name: 'a relation list with a number', entry: change({ related: ['post_2', 3] }) },
  { name: 'a block of a collection the field does not allow', entry: change({ blocks: [{ collection: 'post', id: 'post_2' }] }) },
  { name: 'a block with an unknown option', entry: change({ blocks: [{ collection: 'hero', id: 'hero_1', title: 'x' }] }) },
  { name: 'a block without an id', entry: change({ blocks: [{ collection: 'hero' }] }) },
  { name: 'a list value that is not one of its values', entry: change({ stage: 'published' }) },
  { name: 'a single list value where a list is expected', entry: change({ tags: 'news' }) },
  { name: 'a component item without a required field', entry: change({ feature: { title: 'Big' } }) },
  { name: 'a component item with an unknown field', entry: change({ feature: { title: 'Big', wide: true, colour: 'red' } }) },
  { name: 'a component item with a wrong value', entry: change({ cards: { en: [{ title: 1, wide: false }] } }) },
  { name: 'a single component item as a list', entry: change({ feature: [{ title: 'Big', wide: true }] }) },
  { name: 'a component list without locales', entry: change({ cards: [{ title: 'One', wide: false }] }) },
  { name: 'a mixed item without its component', entry: change({ mixed: [{ title: 'One', wide: true }] }) },
  { name: 'a mixed item of a component the field does not hold', entry: change({ mixed: [{ component: 'grid', title: 'One' }] }) },
  { name: 'a mixed item with fields of another component', entry: change({ mixed: [{ component: 'quote', title: 'One', wide: true }] }) },
  { name: 'a tagged entry field as a bare id', entry: change({ spot: 'author_1' }) },
  { name: 'a tagged entry field pointing at another collection', entry: change({ spot: { collection: 'post', id: 'post_2' } }) },
  { name: 'an unknown status', entry: change({ status: 'draft' }) },
  { name: 'a missing id', entry: without('id') },
  { name: 'a numeric date', entry: change({ createdAt: 1 }) },
]

const stricter: Case[] = [
  { name: 'a date that is not ISO 8601', entry: change({ createdAt: 'yesterday' }) },
  { name: 'an id that cannot be a file name', entry: change({ id: 'post 1' }) },
  { name: 'a text that does not match its pattern', entry: change({ slug: 'Hello World' }) },
  { name: 'a number below its minimum', entry: change({ rating: -1 }) },
  { name: 'a number above its maximum', entry: change({ rating: 6 }) },
  { name: 'a number between its steps', entry: change({ rating: 4.25 }) },
]

const cases = [...accepted, ...rejected, ...stricter]
const schemaText = serializeSchema(schema).replace('from \'forgepress\'', 'from \'../../src/schema/types\'')
const typeErrors = new Map<string, string[]>()

function file(index: number): string {
  return join(scratch, `case-${index}.ts`)
}

beforeAll(() => {
  mkdirSync(scratch, { recursive: true })
  writeFileSync(join(scratch, 'schema.ts'), schemaText)

  cases.forEach((item, index) => writeFileSync(file(index), [
    'import type { EntryOf } from \'../../src/entries/types\'',
    'import type schema from \'./schema\'',
    '',
    `export default ${JSON.stringify(item.entry, null, 2)} satisfies EntryOf<typeof schema, 'post'>`,
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

  for (const name of ['schema.ts', ...cases.map((_, index) => `case-${index}.ts`)]) {
    const source = program.getSourceFile(join(scratch, name))!
    const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]

    typeErrors.set(name, diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')))
  }
}, 60_000)

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function verdicts(index: number): { types: string[], validation: string[] } {
  const text = readFileSync(file(index), 'utf8')
  const issues = validateEntry(parseSchema(schemaText, 'schema.ts'), 'post', parseEntry(text, `case-${index}.ts`))

  return { types: typeErrors.get(`case-${index}.ts`)!, validation: issues.map(issue => issue.message) }
}

describe('entry types and validation', () => {
  it('type-checks the schema itself', () => {
    expect(typeErrors.get('schema.ts')).toEqual([])
  })

  it.each(accepted.map(item => [item.name, cases.indexOf(item)] as const))('both accept %s', (_, index) => {
    expect(verdicts(index)).toEqual({ types: [], validation: [] })
  })

  it.each(rejected.map(item => [item.name, cases.indexOf(item)] as const))('both reject %s', (_, index) => {
    const { types, validation } = verdicts(index)

    expect(types).not.toEqual([])
    expect(validation).not.toEqual([])
  })

  it.each(stricter.map(item => [item.name, cases.indexOf(item)] as const))('only validation rejects %s, which types cannot express', (_, index) => {
    const { types, validation } = verdicts(index)

    expect(types).toEqual([])
    expect(validation).not.toEqual([])
  })
})
