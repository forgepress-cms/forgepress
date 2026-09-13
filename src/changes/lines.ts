import type { DiffLine } from './types'

const LIMIT = 4000

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

  if (left.length > LIMIT || right.length > LIMIT)
    return replaced(left, right)

  const width = right.length + 1
  const common = new Int32Array((left.length + 1) * width)

  const at = (row: number, column: number): number => common[row * width + column] ?? 0

  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      common[row * width + column] = left[row] === right[column]
        ? at(row + 1, column + 1) + 1
        : Math.max(at(row + 1, column), at(row, column + 1))
    }
  }

  const lines: DiffLine[] = []

  let row = 0
  let column = 0

  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) {
      lines.push({ kind: 'keep', text: left[row]! })
      row += 1
      column += 1
    }
    else if (at(row + 1, column) >= at(row, column + 1)) {
      lines.push({ kind: 'remove', text: left[row]! })
      row += 1
    }
    else {
      lines.push({ kind: 'add', text: right[column]! })
      column += 1
    }
  }

  while (row < left.length) {
    lines.push({ kind: 'remove', text: left[row]! })
    row += 1
  }

  while (column < right.length) {
    lines.push({ kind: 'add', text: right[column]! })
    column += 1
  }

  return lines
}

export function counts(lines: readonly DiffLine[]): { added: number, removed: number } {
  return {
    added: lines.filter(line => line.kind === 'add').length,
    removed: lines.filter(line => line.kind === 'remove').length,
  }
}
