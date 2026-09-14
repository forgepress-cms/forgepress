import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { readCommit } from '../../src/disk/commit'

const repository = fileURLToPath(new URL('../..', import.meta.url))
const outside: string[] = []

function elsewhere(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forgepress-commit-'))

  outside.push(dir)

  return dir
}

afterEach(() => {
  for (const dir of outside.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('readCommit', () => {
  it('reads the checked out commit from git', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()

    expect(readCommit(join(repository, 'test/fixtures/project'), { GITHUB_SHA: 'f'.repeat(40) })).toBe(head)
  })

  it('falls back to the commit a CI service names', () => {
    expect(readCommit(elsewhere(), { CI_COMMIT_SHA: `  ${'A1'.repeat(20)}\n` })).toBe('a1'.repeat(20))
    expect(readCommit(elsewhere(), { VERCEL_GIT_COMMIT_SHA: 'main', CF_PAGES_COMMIT_SHA: 'c'.repeat(40) })).toBe('c'.repeat(40))
  })

  it('has no commit without git or a CI variable', () => {
    expect(readCommit(elsewhere(), {})).toBeNull()
  })
})
