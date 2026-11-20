import type { Location, ValuePath } from '../issues'
import { createScanner, locationAt } from './scanner'

export interface ParsedModule {
  value: unknown
  locate: (path: ValuePath) => Location
}

const TYPE_IMPORT = 'Only type imports are allowed, e.g. `import type { Content } from \'forgepress\'`'

function pathKey(path: ValuePath): string {
  return JSON.stringify(path)
}

export function parseModule(text: string, file: string): ParsedModule {
  const offsets = new Map<string, number>()
  const scanner = createScanner(text, file)
  const { char, expectWord, fail, identifier, list, name, number, numberStart, skip, string, template, word } = scanner

  function propertyKey(): string {
    const start = scanner.index
    const current = char()

    if (current === '[')
      fail('Computed keys are not allowed')

    if (text.startsWith('...', scanner.index))
      fail('Spread syntax is not allowed')

    const key = current === '\'' || current === '"'
      ? string(current)
      : numberStart() ? String(number()) : identifier()

    if (key === undefined)
      return fail(scanner.index < text.length ? 'Expected a property name' : 'Unexpected end of file')

    if (key === '__proto__')
      fail('`__proto__` cannot be used as a key', start)

    return key
  }

  function object(path: ValuePath): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    list('}', () => {
      const start = scanner.index
      const key = propertyKey()

      skip()

      if (char() === ',' || char() === '}')
        fail(`Shorthand properties are not allowed; write \`${key}: value\``, start)

      if (char() === '(')
        fail('Methods are not allowed')

      if (char() !== ':')
        fail(scanner.index < text.length ? `Expected \`:\` after \`${key}\`` : 'Unexpected end of file')

      scanner.index += 1

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

      offsets.set(pathKey(child), scanner.index)
      result.push(literal(child))
    })

    return result
  }

  function literal(path: ValuePath): unknown {
    skip()

    const start = scanner.index
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
      scanner.index += 1
      skip()

      if (!numberStart())
        fail(`Expected a number after \`${current}\``)

      return current === '-' ? -number() : number()
    }

    if (numberStart())
      return number()

    if (text.startsWith('...', scanner.index))
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

    return fail(scanner.index < text.length ? 'Expected a literal value' : 'Unexpected end of file')
  }

  function typeReference(): void {
    word('typeof')
    name('Expected a type')
    skip()

    while (char() === '.') {
      scanner.index += 1
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
      scanner.index += 1
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
    offsets.set(pathKey([]), scanner.index)

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

    for (skip(); scanner.index < text.length; skip()) {
      const start = scanner.index

      if (char() === ';') {
        scanner.index += 1
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
