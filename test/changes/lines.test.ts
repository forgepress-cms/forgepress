import { describe, expect, it } from 'vitest'
import { counts, diffLines } from '../../src/changes/lines'

function render(lines: ReturnType<typeof diffLines>): string {
  return lines.map(line => `${line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}${line.text}`).join('\n')
}

describe('line diff', () => {
  it('keeps identical text untouched', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { kind: 'keep', text: 'a' },
      { kind: 'keep', text: 'b' },
    ])
  })

  it('reports an insertion in the middle', () => {
    expect(render(diffLines('a\nc', 'a\nb\nc'))).toBe(' a\n+b\n c')
  })

  it('reports a deletion in the middle', () => {
    expect(render(diffLines('a\nb\nc', 'a\nc'))).toBe(' a\n-b\n c')
  })

  it('reports a replacement as a removal and an addition', () => {
    expect(render(diffLines('a\nb\nc', 'a\nx\nc'))).toBe(' a\n-b\n+x\n c')
  })

  it('treats empty before as all additions', () => {
    expect(diffLines('', 'a\nb').every(line => line.kind === 'add')).toBe(true)
  })

  it('treats empty after as all removals', () => {
    expect(diffLines('a\nb', '').every(line => line.kind === 'remove')).toBe(true)
  })

  it('ignores a single trailing newline', () => {
    expect(diffLines('a\nb\n', 'a\nb\n').every(line => line.kind === 'keep')).toBe(true)
  })

  it('finds the longest common run rather than rewriting everything', () => {
    const lines = diffLines('1\n2\n3\n4\n5', '1\n2\nx\n4\n5')

    expect(counts(lines)).toEqual({ added: 1, removed: 1 })
    expect(lines.filter(line => line.kind === 'keep')).toHaveLength(4)
  })

  it('finds a small change in a large file', () => {
    const before = Array.from({ length: 20000 }, (_, index) => `line ${index}`)
    const after = before.map(line => line === 'line 12345' ? 'line 12345 changed' : line)
    const lines = diffLines(before.join('\n'), after.join('\n'))

    expect(counts(lines)).toEqual({ added: 1, removed: 1 })
    expect(render(lines.filter(line => line.kind !== 'keep'))).toBe('-line 12345\n+line 12345 changed')
  })

  it('shows a rewrite with more than a thousand changed lines as replaced', () => {
    const before = Array.from({ length: 600 }, (_, index) => `old ${index}`).join('\n')
    const after = Array.from({ length: 600 }, (_, index) => `new ${index}`).join('\n')

    expect(diffLines(before, after).map(line => line.kind)).toEqual([...Array.from({ length: 600 }).fill('remove'), ...Array.from({ length: 600 }).fill('add')])
  })

  it('counts additions and removals', () => {
    expect(counts(diffLines('a\nb', 'b\nc'))).toEqual({ added: 1, removed: 1 })
  })
})
