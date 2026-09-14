import type { ParsedModule } from '../files/module'
import type { ContentRow } from '../types/entry'
import type { ContentIssue, ValueIssue } from '../types/issues'
import type { ForgePressSchema } from '../types/schema'
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

export function checkFiles(schemaFile: ContentFile, entryFiles: readonly EntryFile[]): ContentIssue[] {
  const schemaModule = parse(schemaFile)

  if (!('value' in schemaModule))
    return [...schemaModule]

  const schemaIssues = validateSchema(schemaModule.value)

  if (schemaIssues.length > 0)
    return schemaIssues.map(issue => located(schemaFile.path, schemaModule, issue))

  const schema = schemaModule.value as ForgePressSchema
  const issues = new Map(entryFiles.map(file => [file.path, [] as ContentIssue[]]))
  const sources = new Map<string, { path: string, parsed: ParsedModule }>()
  const content: Record<string, Record<string, ContentRow>> = {}

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
    content[collection][id] = parsed.value as ContentRow
    sources.set(entryKey(collection, id), { path, parsed })
  }

  for (const issue of validateReferences(schema, content)) {
    const source = sources.get(entryKey(issue.collection, issue.id))!

    issues.get(source.path)!.push(located(source.path, source.parsed, issue))
  }

  return [...issues.values()].flatMap(found => found.sort(byPosition))
}
