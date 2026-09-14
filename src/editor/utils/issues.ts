import type { RepoTarget } from '../../forge/types'
import type { EntryRef } from '../../types/entry'
import type { ContentIssue } from '../../types/issues'
import { prefixer, toEntryRef } from '../../files/paths'

export interface FileIssues {
  path: string
  entry: EntryRef | undefined
  messages: string[]
}

export function fileIssues(issues: readonly ContentIssue[], target: RepoTarget): FileIssues[] {
  const content = prefixer(target.base)(target.paths.content)
  const files = new Map<string, FileIssues>()

  for (const issue of issues) {
    const file = files.get(issue.file) ?? { path: issue.file, entry: toEntryRef(content, issue.file), messages: [] }

    file.messages.push(issue.message)
    files.set(issue.file, file)
  }

  return [...files.values()]
}
