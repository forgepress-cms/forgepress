import type { ContentIssue, ValueIssue } from '../../types/content/issues'
import type { ContentRow } from '../../types/content/reader'
import type { ForgePressSchema } from '../../types/core/schema'
import type { ParsedModule } from '../parse/module'
import type { ContentPaths } from '../paths'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readCollections } from '../entry/node'
import { ContentError, quote } from '../issues'
import { parseModule } from '../parse/module'
import { defaultPaths, toEntryFile } from '../paths'
import { validateEntry } from '../validate/entry'
import { validateReferences } from '../validate/references'
import { validateSchema } from '../validate/schema'
import { isRecord } from '../value'

interface EntryFile {
  collection: string
  id: string
  file: string
  parsed: ParsedModule | readonly ContentIssue[]
}

async function read(root: string, file: string): Promise<ParsedModule | readonly ContentIssue[]> {
  try {
    return parseModule(await readFile(join(root, file), 'utf8'), file)
  }
  catch (error) {
    if (error instanceof ContentError)
      return error.issues

    throw error
  }
}

function located(file: string, parsed: ParsedModule, issue: ValueIssue): ContentIssue {
  return { file, ...parsed.locate(issue.path), message: issue.message }
}

function byPosition(left: ContentIssue, right: ContentIssue): number {
  return left.line - right.line || left.column - right.column
}

export async function checkContent(root: string, paths: ContentPaths = defaultPaths): Promise<ContentIssue[]> {
  const schemaModule = await read(root, paths.schema)

  if (!('value' in schemaModule))
    return [...schemaModule]

  const schemaIssues = validateSchema(schemaModule.value)

  if (schemaIssues.length > 0)
    return schemaIssues.map(issue => located(paths.schema, schemaModule, issue))

  const schema = schemaModule.value as ForgePressSchema

  const files: EntryFile[] = await Promise.all(readCollections(root, paths).flatMap(directory => directory.ids.map(async (id) => {
    const file = `${paths.content}/${directory.directory}/${toEntryFile(id)}`

    return { collection: directory.collection, id, file, parsed: await read(root, file) }
  })))

  const issues = new Map(files.map(entry => [entry.file, [] as ContentIssue[]]))
  const sources = new Map<string, { file: string, parsed: ParsedModule }>()
  const content: Record<string, Record<string, ContentRow>> = {}

  for (const { collection, id, file, parsed } of files) {
    const found = issues.get(file)!

    if (!('value' in parsed)) {
      found.push(...parsed)
      continue
    }

    found.push(...validateEntry(schema, collection, parsed.value).map(issue => located(file, parsed, issue)))

    if (!isRecord(parsed.value))
      continue

    if (typeof parsed.value.id === 'string' && parsed.value.id !== id)
      found.push(located(file, parsed, { path: ['id'], message: `"id" is ${quote(parsed.value.id)}, but the file is named ${toEntryFile(id)}` }))

    content[collection] ??= {}
    content[collection][id] = parsed.value as ContentRow
    sources.set(`${collection}/${id}`, { file, parsed })
  }

  for (const issue of validateReferences(schema, content)) {
    const source = sources.get(`${issue.collection}/${issue.id}`)!

    issues.get(source.file)!.push(located(source.file, source.parsed, issue))
  }

  return [...issues.values()].flatMap(found => found.sort(byPosition))
}
