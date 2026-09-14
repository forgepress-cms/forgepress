import type { Entry } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { validateSchema } from '../schema/validate'
import { isRecord } from '../utils/value'
import { ContentError } from './issues'
import { parseModule } from './module'

export function parseSchema(text: string, file: string): ForgePressSchema {
  const { value, locate } = parseModule(text, file)
  const issues = validateSchema(value)

  if (issues.length > 0)
    throw new ContentError(issues.map(issue => ({ file, ...locate(issue.path), message: issue.message })))

  return value as ForgePressSchema
}

export function parseEntry(text: string, file: string): Entry {
  const { value, locate } = parseModule(text, file)

  if (!isRecord(value))
    throw new ContentError([{ file, ...locate([]), message: 'An entry has to be an object' }])

  return value as Entry
}
