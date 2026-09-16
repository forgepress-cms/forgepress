export type ValuePath = readonly (string | number)[]

export interface Location {
  line: number
  column: number
}

export interface ValueIssue {
  path: ValuePath
  message: string
}

export interface ContentIssue extends Location {
  file: string
  message: string
}

export function formatIssue(issue: ContentIssue): string {
  return `${issue.file}:${issue.line}:${issue.column} ${issue.message}`
}

export class ContentError extends Error {
  readonly issues: readonly ContentIssue[]

  constructor(issues: readonly ContentIssue[]) {
    super(issues.map(issue => `[forgepress] ${formatIssue(issue)}`).join('\n'))
    this.name = 'ContentError'
    this.issues = issues
  }
}
