import type { Location } from '../issues'
import { ContentError } from '../issues'

export interface Scanner {
  index: number
  fail: (message: string, at?: number) => never
  char: (offset?: number) => string
  skip: () => void
  identifier: () => string | undefined
  word: (expected: string) => boolean
  expectWord: (expected: string, message: string) => void
  name: (message: string) => string
  list: (close: string, item: () => void) => void
  string: (quote: string) => string
  template: () => string
  numberStart: () => boolean
  number: () => number
}

const ID_START = /[$_\p{ID_Start}]/u
const ID_CONTINUE = /[$\u200C\u200D\p{ID_Continue}]/u
const SPACE = /\s/
const DECIMAL = /\d/
const HEX = /[\da-f]/i
const OCTAL = /[0-7]/
const BINARY = /[01]/
const HEX_DIGITS = /^[\da-f]+$/i
const RADIX = /[box]/i
const BREAKS = new Set(['\n', '\r', '\u2028', '\u2029'])

const ESCAPES = new Map([
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ['b', '\b'],
  ['f', '\f'],
  ['v', '\v'],
])

export function locationAt(text: string, offset: number): Location {
  let line = 1
  let start = 0

  for (let position = 0; position < offset; position += 1) {
    const char = text[position]!

    if (BREAKS.has(char) && !(char === '\r' && text[position + 1] === '\n')) {
      line += 1
      start = position + 1
    }
  }

  return { line, column: offset - start + 1 }
}

export function createScanner(text: string, file: string): Scanner {
  let index = text.startsWith('\uFEFF') ? 1 : 0

  function fail(message: string, at: number = index): never {
    throw new ContentError([{ file, ...locationAt(text, at), message }])
  }

  function char(offset = 0): string {
    return text[index + offset] ?? ''
  }

  function skip(): void {
    while (index < text.length) {
      if (SPACE.test(char())) {
        index += 1
      }
      else if (text.startsWith('//', index)) {
        while (index < text.length && !BREAKS.has(char()))
          index += 1
      }
      else if (text.startsWith('/*', index)) {
        const end = text.indexOf('*/', index + 2)

        if (end === -1)
          fail('Unterminated comment')

        index = end + 2
      }
      else {
        return
      }
    }
  }

  function width(pattern: RegExp): number {
    const point = text.codePointAt(index)

    if (point === undefined || !pattern.test(String.fromCodePoint(point)))
      return 0

    return point > 0xFFFF ? 2 : 1
  }

  function identifier(): string | undefined {
    const start = index

    for (let step = width(ID_START); step > 0; step = width(ID_CONTINUE))
      index += step

    return index > start ? text.slice(start, index) : undefined
  }

  function word(expected: string): boolean {
    skip()

    const start = index

    if (identifier() === expected)
      return true

    index = start

    return false
  }

  function expectWord(expected: string, message: string): void {
    if (!word(expected))
      fail(message)
  }

  function name(message: string): string {
    skip()

    return identifier() ?? fail(message)
  }

  function list(close: string, item: () => void): void {
    index += 1

    for (skip(); char() !== close; skip()) {
      item()
      skip()

      if (char() === ',')
        index += 1
      else if (char() !== close)
        fail(index < text.length ? `Expected \`,\` or \`${close}\`` : 'Unexpected end of file')
    }

    index += 1
  }

  function hex(count: number, start: number): number {
    const digits = text.slice(index, index + count)

    if (digits.length < count || !HEX_DIGITS.test(digits))
      fail('Invalid escape sequence', start)

    index += count

    return Number.parseInt(digits, 16)
  }

  function unicode(start: number): string {
    if (char() !== '{')
      return String.fromCharCode(hex(4, start))

    const end = text.indexOf('}', index)
    const digits = end === -1 ? '' : text.slice(index + 1, end)

    if (!HEX_DIGITS.test(digits) || Number.parseInt(digits, 16) > 0x10FFFF)
      fail('Invalid escape sequence', start)

    index = end + 1

    return String.fromCodePoint(Number.parseInt(digits, 16))
  }

  function escape(unterminated: string, opening: number): string {
    const start = index - 1
    const current = char()

    if (current === '')
      fail(unterminated, opening)

    index += 1

    const simple = ESCAPES.get(current)

    if (simple !== undefined)
      return simple

    if (current === '\r' && char() === '\n')
      index += 1

    if (BREAKS.has(current))
      return ''

    if (current === 'x')
      return String.fromCharCode(hex(2, start))

    if (current === 'u')
      return unicode(start)

    if (DECIMAL.test(current) && (current !== '0' || DECIMAL.test(char())))
      fail(`\`\\${current}\` is not a valid escape sequence`, start)

    if (current === '0')
      return '\0'

    const point = text.codePointAt(start + 1)!

    index = start + 1 + (point > 0xFFFF ? 2 : 1)

    return String.fromCodePoint(point)
  }

  function string(quote: string): string {
    const start = index
    let result = ''
    let run = index + 1

    index = run

    while (char() !== quote) {
      const current = char()

      if (current === '' || current === '\n' || current === '\r')
        fail('Unterminated string', start)

      if (current === '\\') {
        result += text.slice(run, index)
        index += 1
        result += escape('Unterminated string', start)
        run = index
      }
      else {
        index += 1
      }
    }

    result += text.slice(run, index)
    index += 1

    return result
  }

  function template(): string {
    const start = index
    let result = ''
    let run = index + 1

    index = run

    while (char() !== '`') {
      const current = char()

      if (current === '')
        fail('Unterminated template literal', start)

      if (current === '$' && char(1) === '{')
        fail('Template literals cannot contain substitutions')

      if (current === '\\' || current === '\r') {
        result += text.slice(run, index)
        index += 1

        if (current === '\\') {
          result += escape('Unterminated template literal', start)
        }
        else {
          result += '\n'

          if (char() === '\n')
            index += 1
        }

        run = index
      }
      else {
        index += 1
      }
    }

    result += text.slice(run, index)
    index += 1

    return result
  }

  function digits(pattern: RegExp, start: number): string {
    const from = index

    while (pattern.test(char()) || char() === '_') {
      if (char() === '_' && (index === from || !pattern.test(char(1))))
        fail('Invalid numeric separator', start)

      index += 1
    }

    if (index === from)
      fail('Invalid number', start)

    return text.slice(from, index).replaceAll('_', '')
  }

  function numberStart(): boolean {
    return DECIMAL.test(char()) || (char() === '.' && DECIMAL.test(char(1)))
  }

  function number(): number {
    const start = index
    let source = ''

    if (char() === '0' && RADIX.test(char(1))) {
      const radix = char(1).toLowerCase()

      index += 2
      source = `0${radix}${digits(radix === 'x' ? HEX : radix === 'o' ? OCTAL : BINARY, start)}`
    }
    else {
      if (char() === '0' && (DECIMAL.test(char(1)) || char(1) === '_'))
        fail('Numbers cannot start with a leading zero', start)

      if (char() !== '.')
        source = digits(DECIMAL, start)

      if (char() === '.') {
        index += 1
        source += `.${DECIMAL.test(char()) ? digits(DECIMAL, start) : ''}`
      }

      if (char() === 'e' || char() === 'E') {
        index += 1

        const sign = char() === '+' || char() === '-' ? char() : ''

        index += sign.length
        source += `e${sign}${digits(DECIMAL, start)}`
      }
    }

    if (char() === 'n')
      fail('BigInt values are not allowed', start)

    if (DECIMAL.test(char()) || width(ID_START) > 0)
      fail('Invalid number', start)

    const value = Number(source)

    if (!Number.isFinite(value))
      fail('Number is out of range', start)

    return value
  }

  return {
    get index() {
      return index
    },
    set index(value) {
      index = value
    },
    fail,
    char,
    skip,
    identifier,
    word,
    expectWord,
    name,
    list,
    string,
    template,
    numberStart,
    number,
  }
}
