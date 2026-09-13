import type { ContentIssue } from '../types/content/issues'

export function quote(value: unknown): string {
  return JSON.stringify(value) ?? String(value)
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
