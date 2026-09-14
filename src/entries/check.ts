import type { ParsedModule } from '../files/module'
import type { Entry } from '../types/entry'
import type { ContentIssue, ValueIssue } from '../types/issues'
import type { ForgePressSchema } from '../types/schema'
import type { ContentEntries } from './references'
import { ContentError } from '../files/issues'
import { parseModule } from '../files/module'
import { toEntryFile } from '../files/paths'
import { validateSchema } from '../schema/validate'
import { isRecord, quote } from '../utils/value'
import { entryKey, validateReferences } from './references'
import { validateEntry } from './validate'

export interface ContentFile {
  path: string
  text: string
}

export interface EntryFile extends ContentFile {
  collection: string
  id: string
}

export interface ParsedContent {
  issues: ContentIssue[]
  schema: ForgePressSchema | undefined
  content: ContentEntries
}

function parse(file: ContentFile): ParsedModule | readonly ContentIssue[] {
  try {
    return parseModule(file.text, file.path)
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

export function parseContent(schemaFile: ContentFile, entryFiles: readonly EntryFile[]): ParsedContent {
  const schemaModule = parse(schemaFile)

  if (!('value' in schemaModule))
    return { issues: [...schemaModule], schema: undefined, content: {} }

  const schemaIssues = validateSchema(schemaModule.value)

  if (schemaIssues.length > 0)
    return { issues: schemaIssues.map(issue => located(schemaFile.path, schemaModule, issue)), schema: undefined, content: {} }

  const schema = schemaModule.value as ForgePressSchema
  const issues = new Map(entryFiles.map(file => [file.path, [] as ContentIssue[]]))
  const sources = new Map<string, { path: string, parsed: ParsedModule }>()
  const content: Record<string, Record<string, Entry>> = {}

  for (const file of entryFiles) {
    const { collection, id, path } = file
    const found = issues.get(path)!
    const parsed = parse(file)

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

export function checkFiles(schemaFile: ContentFile, entryFiles: readonly EntryFile[]): ContentIssue[] {
  return parseContent(schemaFile, entryFiles).issues
}
