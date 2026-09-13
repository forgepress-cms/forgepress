import { describe, expect, it } from 'vitest'
import { counts, diffLines } from '../src/changes/lines'

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

  it('counts additions and removals', () => {
    expect(counts(diffLines('a\nb', 'b\nc'))).toEqual({ added: 1, removed: 1 })
  })
})
