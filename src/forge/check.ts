import type { ContentFiles } from '../files/content'
import type { ContentIssue } from '../files/issues'
import type { FileChange, RepoTarget } from './types'
import { readContent } from '../files/content'
import { base64ToText } from '../utils/encoding'

type Text = () => Promise<string>

export async function checkResult(listing: ReadonlyMap<string, string>, files: readonly FileChange[], read: (sha: string) => Promise<string>, target: RepoTarget): Promise<ContentIssue[]> {
  const result = new Map<string, Text>([...listing].map(([path, sha]) => [path, () => read(sha)]))

  for (const file of files) {
    if ('removed' in file)
      result.delete(file.path)
    else
      result.set(file.path, async () => file.encoding === 'base64' ? base64ToText(file.data) : file.data)
  }

  const published: ContentFiles = {
    list: async directory => [...result.keys()].filter(path => path.startsWith(`${directory}/`)),
    read: async path => result.get(path)?.(),
  }

  return (await readContent(published, target.paths)).issues
}
