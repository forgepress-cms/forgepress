import type { Location, ValuePath } from '../types/issues'
import { ContentError } from './issues'

export interface ParsedModule {
  value: unknown
  locate: (path: ValuePath) => Location
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
const TYPE_IMPORT = 'Only type imports are allowed, e.g. `import type { ForgePressEntry } from \'forgepress\'`'

const ESCAPES = new Map([
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ['b', '\b'],
  ['f', '\f'],
  ['v', '\v'],
])

function locationAt(text: string, offset: number): Location {
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

function pathKey(path: ValuePath): string {
  return JSON.stringify(path)
}

export function parseModule(text: string, file: string): ParsedModule {
  const offsets = new Map<string, number>()
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

  function propertyKey(): string {
    const start = index
    const current = char()

    if (current === '[')
      fail('Computed keys are not allowed')

    if (text.startsWith('...', index))
      fail('Spread syntax is not allowed')

    const key = current === '\'' || current === '"'
      ? string(current)
      : numberStart() ? String(number()) : identifier()

    if (key === undefined)
      fail(index < text.length ? 'Expected a property name' : 'Unexpected end of file')

    if (key === '__proto__')
      fail('`__proto__` cannot be used as a key', start)

    return key
  }

  function object(path: ValuePath): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    list('}', () => {
      const start = index
      const key = propertyKey()

      skip()

      if (char() === ',' || char() === '}')
        fail(`Shorthand properties are not allowed; write \`${key}: value\``, start)

      if (char() === '(')
        fail('Methods are not allowed')

      if (char() !== ':')
        fail(index < text.length ? `Expected \`:\` after \`${key}\`` : 'Unexpected end of file')

      index += 1

      if (Object.hasOwn(result, key))
        fail(`Duplicate key \`${key}\``, start)

      const child = [...path, key]

      offsets.set(pathKey(child), start)
      result[key] = literal(child)
    })

    return result
  }

  function array(path: ValuePath): unknown[] {
    const result: unknown[] = []

    list(']', () => {
      if (char() === ',')
        fail('Empty array slots are not allowed')

      const child = [...path, result.length]

      offsets.set(pathKey(child), index)
      result.push(literal(child))
    })

    return result
  }

  function literal(path: ValuePath): unknown {
    skip()

    const start = index
    const current = char()

    if (current === '{')
      return object(path)

    if (current === '[')
      return array(path)

    if (current === '\'' || current === '"')
      return string(current)

    if (current === '`')
      return template()

    if (current === '-' || current === '+') {
      index += 1
      skip()

      if (!numberStart())
        fail(`Expected a number after \`${current}\``)

      return current === '-' ? -number() : number()
    }

    if (numberStart())
      return number()

    if (text.startsWith('...', index))
      fail('Spread syntax is not allowed')

    const found = identifier()

    if (found === 'true' || found === 'false')
      return found === 'true'

    if (found === 'null' || found === 'undefined')
      fail(`\`${found}\` is not supported; leave the value out instead`, start)

    if (found === 'NaN' || found === 'Infinity')
      fail(`\`${found}\` cannot be stored`, start)

    if (found !== undefined)
      fail(`\`${found}\` is not a literal value; variables, calls and expressions are not allowed`, start)

    return fail(index < text.length ? 'Expected a literal value' : 'Unexpected end of file')
  }

  function typeReference(): void {
    word('typeof')
    name('Expected a type')
    skip()

    while (char() === '.') {
      index += 1
      name('Expected a type')
      skip()
    }

    if (char() === '<') {
      list('>', () => {
        const quote = char()

        if (quote === '\'' || quote === '"')
          string(quote)
        else
          typeReference()
      })
    }
  }

  function importDeclaration(start: number): void {
    if (!word('type'))
      fail(TYPE_IMPORT, start)

    skip()

    if (char() === '{') {
      list('}', () => {
        name('Expected an import name')

        if (word('as'))
          name('Expected an import name')
      })
    }
    else if (char() === '*') {
      index += 1
      expectWord('as', 'Expected `as`')
      name('Expected an import name')
    }
    else if (name('Expected an import clause') === 'from') {
      skip()

      if (char() === '\'' || char() === '"')
        fail(TYPE_IMPORT, start)
    }

    expectWord('from', 'Expected `from`')
    skip()

    if (char() !== '\'' && char() !== '"')
      fail('Expected a module name')

    string(char())
  }

  function exportDefault(): unknown {
    expectWord('default', 'Only `export default` is allowed')
    skip()
    offsets.set(pathKey([]), index)

    const value = literal([])

    if (word('as'))
      expectWord('const', 'Only `as const` is allowed; use `satisfies` to type the value')

    if (word('satisfies'))
      typeReference()

    return value
  }

  function statements(): unknown {
    let exported = false
    let value: unknown

    for (skip(); index < text.length; skip()) {
      const start = index

      if (char() === ';') {
        index += 1
        continue
      }

      if (exported)
        fail('Nothing may follow `export default`')

      const keyword = identifier()

      if (keyword === 'import') {
        importDeclaration(start)
      }
      else if (keyword === 'export') {
        value = exportDefault()
        exported = true
      }
      else {
        fail('Only `import type` and `export default` are allowed', start)
      }
    }

    if (!exported)
      fail('Missing `export default`')

    return value
  }

  const value = statements()

  return {
    value,

    locate(path) {
      for (let depth = path.length; depth >= 0; depth -= 1) {
        const offset = offsets.get(pathKey(path.slice(0, depth)))

        if (offset !== undefined)
          return locationAt(text, offset)
      }

      return locationAt(text, 0)
    },
  }
}
