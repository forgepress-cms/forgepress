import { execFileSync } from 'node:child_process'
import process from 'node:process'

const COMMIT = /^[\da-f]{40}(?:[\da-f]{24})?$/i

export const COMMIT_VARIABLES = [
  'GITHUB_SHA',
  'CI_COMMIT_SHA',
  'COMMIT_REF',
  'VERCEL_GIT_COMMIT_SHA',
  'CF_PAGES_COMMIT_SHA',
  'RENDER_GIT_COMMIT',
  'AWS_COMMIT_ID',
  'SOURCE_VERSION',
] as const

function gitHead(root: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }
  catch {
    return undefined
  }
}

export function readCommit(root: string, env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const found = [gitHead(root), ...COMMIT_VARIABLES.map(name => env[name]?.trim())].find(value => value !== undefined && COMMIT.test(value))

  return found?.toLowerCase() ?? null
}
