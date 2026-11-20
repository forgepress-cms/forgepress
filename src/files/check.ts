import type { ContentEntries, Entry } from '../entries'
import type { ContentIssue } from '../issues'
import type { Schema } from '../schema'
import type { ParsedModule } from './module'
import type { ContentFile, ParsedSchema } from './parse'
import { entryKey, validateEntry, validateReferences, validateSingles } from '../entries'
import { isRecord, quote } from '../utils'
import { located, parseFile, parseSchemaFile } from './parse'
import { toEntryFile } from './paths'

export interface EntryFile extends ContentFile {
  collection: string
  id: string
}

export interface ParsedContent {
  issues: ContentIssue[]
  schema: Schema | undefined
  content: ContentEntries
}

function byPosition(left: ContentIssue, right: ContentIssue): number {
  return left.line - right.line || left.column - right.column
}

export function parseContent(schemaFile: ContentFile | undefined, entryFiles: readonly EntryFile[]): ParsedContent {
  const parsedSchema: ParsedSchema = schemaFile ? parseSchemaFile(schemaFile) : { schema: { collections: {} } }

  if ('issues' in parsedSchema)
    return { issues: parsedSchema.issues, schema: undefined, content: {} }

  const { schema } = parsedSchema
  const issues = new Map(entryFiles.map(file => [file.path, [] as ContentIssue[]]))
  const sources = new Map<string, { path: string, parsed: ParsedModule }>()
  const content: Record<string, Record<string, Entry>> = {}

  for (const file of entryFiles) {
    const { collection, id, path } = file
    const found = issues.get(path)!
    const parsed = parseFile(file)

    if (!('value' in parsed)) {
      found.push(...parsed)
      continue
    }

    found.push(...validateEntry(schema, collection, parsed.value).map(issue => located(path, parsed, issue)))

    if (!isRecord(parsed.value))
      continue

    if (typeof parsed.value.id === 'string' && parsed.value.id !== id)
      found.push(located(path, parsed, { path: ['id'], message: `"id" is ${quote(parsed.value.id)}, but the file is named ${toEntryFile(id)}` }))

    content[collection] ??= {}
    content[collection][id] = parsed.value as Entry
    sources.set(entryKey(collection, id), { path, parsed })
  }

  for (const issue of [...validateReferences(schema, content), ...validateSingles(schema, content)]) {
    const source = sources.get(entryKey(issue.collection, issue.id))!

    issues.get(source.path)!.push(located(source.path, source.parsed, issue))
  }

  return { issues: [...issues.values()].flatMap(found => found.sort(byPosition)), schema, content }
}
