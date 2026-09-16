import type { ContentIssue } from '../files/issues'
import type { ParsedModule } from '../files/module'
import type { ContentFile, ParsedSchema } from '../files/parse'
import type { ForgePressSchema } from '../schema/types'
import type { ContentEntries } from './references'
import type { Entry } from './types'
import { located, parseFile, parseSchemaFile } from '../files/parse'
import { toEntryFile } from '../files/paths'
import { isRecord, quote } from '../utils/value'
import { entryKey, validateReferences } from './references'
import { validateEntry } from './validate'

export interface EntryFile extends ContentFile {
  collection: string
  id: string
}

export interface ParsedContent {
  issues: ContentIssue[]
  schema: ForgePressSchema | undefined
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

  for (const issue of validateReferences(schema, content)) {
    const source = sources.get(entryKey(issue.collection, issue.id))!

    issues.get(source.path)!.push(located(source.path, source.parsed, issue))
  }

  return { issues: [...issues.values()].flatMap(found => found.sort(byPosition)), schema, content }
}
