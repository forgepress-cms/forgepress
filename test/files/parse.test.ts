import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { ContentError } from '../../src/files/issues'
import { parseModule } from '../../src/files/module'
import { parseEntry, parseSchema } from '../../src/files/parse'

function parse(text: string): unknown {
  return parseModule(text, 'entry.ts').value
}

function value(literal: string): unknown {
  return parse(`export default ${literal}`)
}

function evaluate(literal: string): unknown {
  return runInNewContext(`'use strict'; (${literal})`)
}

function failure(text: string): { message: string, line: number, column: number } {
  try {
    parseModule(text, 'entry.ts')
  }
  catch (error) {
    if (error instanceof ContentError)
      return error.issues[0]!

    throw error
  }

  throw new Error('expected the module to be rejected')
}

describe('module shape', () => {
  it('reads an entry as the editor writes it', () => {
    const text = `import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'hero_1',
  status: 'published',
  headline: {
    en: 'Hello',
  },
} satisfies ForgePressEntry<'hero'>
`

    expect(parse(text)).toEqual({ id: 'hero_1', status: 'published', headline: { en: 'Hello' } })
  })

  it('reads a schema declared as a constant', () => {
    const text = `import type { ForgePressSchema } from 'forgepress'

export default { collections: {} } as const satisfies ForgePressSchema
`

    expect(parse(text)).toEqual({ collections: {} })
  })

  it('accepts what formatters and people add around the value', () => {
    const text = `\uFEFF// generated once, edited by hand
import type { ForgePressEntry } from "forgepress";
import type * as forgepress from 'forgepress'
import type { A as B, C, } from 'x'

/* the entry */
export default {
  "quoted": 'single', // trailing comment
  double: "quotes",
  list: [1, 2, 3,],
  /* between */ nested: { deep: [{ a: true }, { b: false }] },
} satisfies forgepress.ForgePressEntry<"hero", Other<'x'>,>;;
`

    expect(parse(text)).toEqual({
      quoted: 'single',
      double: 'quotes',
      list: [1, 2, 3],
      nested: { deep: [{ a: true }, { b: false }] },
    })
  })

  it('accepts type queries in the type', () => {
    const text = `import type { EntryOf } from 'forgepress'
import type schema from '../../schema'

export default { id: 'a' } satisfies EntryOf<typeof schema, 'post'>
`

    expect(parse(text)).toEqual({ id: 'a' })
  })

  it('accepts a module without imports or types', () => {
    expect(value('[1, \'two\']')).toEqual([1, 'two'])
  })

  it('reads keys the way JavaScript does', () => {
    const literal = '{ default: 1, import: 2, größe: 3, $x: 4, _y: 5, 1: 6, 0x10: 7, 1.50: 8, \'a-b\': 9 }'

    expect(value(literal)).toEqual(evaluate(literal))
  })
})

describe('literal values', () => {
  it.each([
    '\'\\x41\\u0042\\u{1F600}\\0\\b\\f\\v\\n\\r\\t\\\'\\"\\\\\\a\\ü\'',
    '"it\'s"',
    '\'line \\\ncontinues\'',
    '\'line \\\r\ncontinues\'',
    '\'a\u2028b\u2029c\'',
    '\'😀 \\😀\'',
    '`multi\nline`',
    '`carriage\r\nreturn\rline`',
    `\`with $ and \\\${escaped} and \\\` tick\``,
    '\'\\u{0000041}\'',
  ])('reads the string %s as JavaScript does', (literal) => {
    expect(value(literal)).toBe(evaluate(literal))
  })

  it.each([
    '0',
    '-1',
    '+2',
    '1.5',
    '.5',
    '5.',
    '1e3',
    '1E-3',
    '2.5e+2',
    '0x1F',
    '0XfF',
    '0o17',
    '0b101',
    '1_000_000',
    '0.000_1',
    '- /* sign */ 4',
    '9007199254740993',
  ])('reads the number %s as JavaScript does', (literal) => {
    expect(value(literal)).toBe(evaluate(literal))
  })

  it('reads booleans', () => {
    expect(value('[true, false]')).toEqual([true, false])
  })

  it('creates plain own properties', () => {
    const result = value('{ constructor: 1, toString: 2 }') as Record<string, unknown>

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.keys(result)).toEqual(['constructor', 'toString'])
  })
})

describe('rejected syntax', () => {
  it.each([
    ['export default { a: foo }', '`foo` is not a literal value; variables, calls and expressions are not allowed'],
    ['export default load()', '`load` is not a literal value; variables, calls and expressions are not allowed'],
    ['export default { ...base }', 'Spread syntax is not allowed'],
    ['export default [...items]', 'Spread syntax is not allowed'],
    ['export default { [key]: 1 }', 'Computed keys are not allowed'],
    ['export default { a }', 'Shorthand properties are not allowed; write `a: value`'],
    ['export default { a() {} }', 'Methods are not allowed'],
    ['export default { get a() { return 1 } }', 'Expected `:` after `get`'],
    [`export default \`\${name}\``, 'Template literals cannot contain substitutions'],
    ['export default { a: null }', '`null` is not supported; leave the value out instead'],
    ['export default { a: undefined }', '`undefined` is not supported; leave the value out instead'],
    ['export default NaN', '`NaN` cannot be stored'],
    ['export default -Infinity', 'Expected a number after `-`'],
    ['export default 10n', 'BigInt values are not allowed'],
    ['export default 010', 'Numbers cannot start with a leading zero'],
    ['export default 0_1', 'Numbers cannot start with a leading zero'],
    ['export default 1__0', 'Invalid numeric separator'],
    ['export default 1_', 'Invalid numeric separator'],
    ['export default 3in', 'Invalid number'],
    ['export default 1e999', 'Number is out of range'],
    ['export default \'\\1\'', '`\\1` is not a valid escape sequence'],
    ['export default \'\\8\'', '`\\8` is not a valid escape sequence'],
    ['export default \'\\xZZ\'', 'Invalid escape sequence'],
    ['export default \'\\u{110000}\'', 'Invalid escape sequence'],
    ['export default { a: 1, a: 2 }', 'Duplicate key `a`'],
    ['export default { a: 1, \'a\': 2 }', 'Duplicate key `a`'],
    ['export default { __proto__: {} }', '`__proto__` cannot be used as a key'],
    ['export default [1,,2]', 'Empty array slots are not allowed'],
    ['export default { a: 1 b: 2 }', 'Expected `,` or `}`'],
    ['export default \'open', 'Unterminated string'],
    ['export default \'broken\nline\'', 'Unterminated string'],
    ['export default `open', 'Unterminated template literal'],
    ['export default /* open', 'Unterminated comment'],
    ['export default { a: [1, 2', 'Unexpected end of file'],
    ['export default', 'Unexpected end of file'],
    ['export default {} as ForgePressSchema', 'Only `as const` is allowed; use `satisfies` to type the value'],
    ['export default {} satisfies', 'Expected a type'],
    ['export default {}\nexport const b = 1', 'Nothing may follow `export default`'],
    ['export default 1\nexport default 2', 'Nothing may follow `export default`'],
    ['export const a = 1', 'Only `export default` is allowed'],
    ['const a = 1\nexport default a', 'Only `import type` and `export default` are allowed'],
    ['\'use strict\'\nexport default 1', 'Only `import type` and `export default` are allowed'],
    ['import { a } from \'a\'\nexport default 1', 'Only type imports are allowed, e.g. `import type { ForgePressEntry } from \'forgepress\'`'],
    ['import a from \'a\'\nexport default 1', 'Only type imports are allowed, e.g. `import type { ForgePressEntry } from \'forgepress\'`'],
    ['import type from \'a\'\nexport default 1', 'Only type imports are allowed, e.g. `import type { ForgePressEntry } from \'forgepress\'`'],
    ['import \'side-effect\'\nexport default 1', 'Only type imports are allowed, e.g. `import type { ForgePressEntry } from \'forgepress\'`'],
    ['import type { A } from a\nexport default 1', 'Expected a module name'],
    ['// nothing here', 'Missing `export default`'],
  ])('rejects %j', (text, message) => {
    expect(failure(text).message).toBe(message)
  })

  it('points at the offending token', () => {
    const text = [
      'import type { ForgePressEntry } from \'forgepress\'',
      '',
      'export default {',
      '  id: \'post_1\',',
      '  author: someone,',
      '} satisfies ForgePressEntry<\'post\'>',
    ].join('\r\n')

    expect(failure(text)).toMatchObject({ line: 5, column: 11 })
  })

  it('names the file in the error message', () => {
    expect(() => parseModule('export default { a: b }', '.forgepress/content/post/post_1.ts'))
      .toThrow('[forgepress] .forgepress/content/post/post_1.ts:1:21 `b` is not a literal value')
  })
})

describe('locations', () => {
  const text = [
    'export default {',
    '  collections: {',
    '    hero: {',
    '      fields: [',
    '        { type: \'text\' },',
    '        { type: \'nope\' },',
    '      ],',
    '    },',
    '  },',
    '}',
  ].join('\n')

  it('locates the key of a property', () => {
    expect(parseModule(text, 'schema.ts').locate(['collections', 'hero'])).toEqual({ line: 3, column: 5 })
  })

  it('locates an array item', () => {
    expect(parseModule(text, 'schema.ts').locate(['collections', 'hero', 'fields', 1])).toEqual({ line: 6, column: 9 })
  })

  it('falls back to the closest parent that exists', () => {
    expect(parseModule(text, 'schema.ts').locate(['collections', 'hero', 'label'])).toEqual({ line: 3, column: 5 })
  })

  it('locates the default export itself', () => {
    expect(parseModule(text, 'schema.ts').locate([])).toEqual({ line: 1, column: 16 })
  })
})

describe('parseEntry', () => {
  it('wants an object', () => {
    expect(() => parseEntry('export default []', 'post.ts')).toThrow('[forgepress] post.ts:1:16 An entry has to be an object')
  })
})

describe('parseSchema', () => {
  it('reports every schema problem with its position', () => {
    const text = [
      'export default {',
      '  collections: {',
      '    post: {',
      '      fields: {',
      '        author: { type: \'collection\', collections: [\'autor\'] },',
      '        title: { type: \'text\', translate: true },',
      '      },',
      '    },',
      '  },',
      '}',
    ].join('\n')

    try {
      parseSchema(text, '.forgepress/schema.ts')
      expect.unreachable()
    }
    catch (error) {
      expect((error as ContentError).issues).toEqual([
        { file: '.forgepress/schema.ts', line: 5, column: 53, message: 'Field "post.author" references unknown collection "autor"' },
        { file: '.forgepress/schema.ts', line: 6, column: 32, message: 'Field "post.title" is translated, but the schema has no locales' },
      ])
    }
  })
})
