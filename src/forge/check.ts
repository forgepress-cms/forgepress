import type { EntryFile } from '../entries/check'
import type { ContentIssue } from '../types/issues'
import type { FileChange, RepoTarget } from './types'
import { checkFiles } from '../entries/check'
import { prefixer, toEntryRef } from '../files/paths'
import { base64ToText } from '../utils/encoding'

type Text = () => Promise<string>

export async function checkResult(listing: ReadonlyMap<string, string>, files: readonly FileChange[], read: (sha: string) => Promise<string>, target: RepoTarget): Promise<ContentIssue[]> {
  const at = prefixer(target.base)
  const content = at(target.paths.content)
  const schema = at(target.paths.schema)
  const result = new Map<string, Text>([...listing].map(([path, sha]) => [path, () => read(sha)]))

  for (const file of files) {
    if ('removed' in file)
      result.delete(file.path)
    else
      result.set(file.path, async () => file.encoding === 'base64' ? base64ToText(file.data) : file.data)
  }

  const schemaText = result.get(schema)

  if (!schemaText)
    throw new Error(`[forgepress] ${schema} does not exist in the repository`)

  const entries = await Promise.all([...result]
    .sort(([left], [right]) => left < right ? -1 : 1)
    .flatMap(([path, text]): Promise<EntryFile>[] => {
      const entry = toEntryRef(content, path)

      return entry ? [text().then(value => ({ ...entry, path, text: value }))] : []
    }))

  return checkFiles({ path: schema, text: await schemaText() }, entries)
}
