import type { ContentRow } from '../../types/content/reader'
import type { ForgePressSchema } from '../../types/core/schema'
import { ContentError } from '../issues'
import { validateSchema } from '../validate/schema'
import { isRecord } from '../value'
import { parseModule } from './module'

export function parseSchema(text: string, file: string): ForgePressSchema {
  const { value, locate } = parseModule(text, file)
  const issues = validateSchema(value)

  if (issues.length > 0)
    throw new ContentError(issues.map(issue => ({ file, ...locate(issue.path), message: issue.message })))

  return value as ForgePressSchema
}

export function parseEntry(text: string, file: string): ContentRow {
  const { value, locate } = parseModule(text, file)

  if (!isRecord(value))
    throw new ContentError([{ file, ...locate([]), message: 'An entry has to be an object' }])

  return value as ContentRow
}
