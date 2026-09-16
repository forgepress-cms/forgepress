import type { DiffLine } from './types'
import { diffArrays } from 'diff'

const LIMIT = 1000

function split(text: string): string[] {
  return text.length === 0 ? [] : text.replace(/\n$/, '').split('\n')
}

function replaced(before: string[], after: string[]): DiffLine[] {
  return [
    ...before.map((text): DiffLine => ({ kind: 'remove', text })),
    ...after.map((text): DiffLine => ({ kind: 'add', text })),
  ]
}

export function diffLines(before: string, after: string): DiffLine[] {
  const left = split(before)
  const right = split(after)
  const changes = diffArrays(left, right, { maxEditLength: LIMIT })

  if (!changes)
    return replaced(left, right)

  return changes.flatMap(change => change.value.map((text): DiffLine => ({ kind: change.added ? 'add' : change.removed ? 'remove' : 'keep', text })))
}

export function counts(lines: readonly DiffLine[]): { added: number, removed: number } {
  return {
    added: lines.filter(line => line.kind === 'add').length,
    removed: lines.filter(line => line.kind === 'remove').length,
  }
}
