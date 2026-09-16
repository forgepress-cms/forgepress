import type { Entry } from '../entries/types'
import type { ForgePressSchema } from '../schema/types'
import type { ContentIssue, ValueIssue } from './issues'
import type { ParsedModule } from './module'
import { validateSchema } from '../schema/validate'
import { isRecord } from '../utils/value'
import { ContentError } from './issues'
import { parseModule } from './module'

export interface ContentFile {
  path: string
  text: string
}

export type ParsedSchema = { schema: ForgePressSchema } | { issues: ContentIssue[] }

export function parseFile(file: ContentFile): ParsedModule | readonly ContentIssue[] {
  try {
    return parseModule(file.text, file.path)
  }
  catch (error) {
    if (error instanceof ContentError)
      return error.issues

    throw error
  }
}

export function located(file: string, parsed: ParsedModule, issue: ValueIssue): ContentIssue {
  return { file, ...parsed.locate(issue.path), message: issue.message }
}

export function parseSchemaFile(file: ContentFile): ParsedSchema {
  const parsed = parseFile(file)

  if (!('value' in parsed))
    return { issues: [...parsed] }

  const issues = validateSchema(parsed.value)

  return issues.length > 0
    ? { issues: issues.map(issue => located(file.path, parsed, issue)) }
    : { schema: parsed.value as ForgePressSchema }
}

export function parseSchema(text: string, file: string): ForgePressSchema {
  const parsed = parseSchemaFile({ path: file, text })

  if ('issues' in parsed)
    throw new ContentError(parsed.issues)

  return parsed.schema
}

export function parseEntry(text: string, file: string): Entry {
  const { value, locate } = parseModule(text, file)

  if (!isRecord(value))
    throw new ContentError([{ file, ...locate([]), message: 'An entry has to be an object' }])

  return value as Entry
}
