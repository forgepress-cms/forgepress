import type { EntryRef } from '../../src/entries/types'
import type { ContentIssue } from '../../src/files/issues'
import type { RepoTarget } from '../../src/forge/types'
import { toEntryRef } from '../../src/files/paths'

export interface FileIssues {
  path: string
  entry: EntryRef | undefined
  messages: string[]
}

export function fileIssues(issues: readonly ContentIssue[], target: RepoTarget): FileIssues[] {
  const files = new Map<string, FileIssues>()

  for (const issue of issues) {
    const file = files.get(issue.file) ?? { path: issue.file, entry: toEntryRef(target.paths.content, issue.file), messages: [] }

    file.messages.push(issue.message)
    files.set(issue.file, file)
  }

  return [...files.values()]
}
