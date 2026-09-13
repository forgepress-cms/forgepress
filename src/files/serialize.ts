import type { ContentConfig } from '../types/config'
import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { META_KEYS } from '../entries/meta'

const IDENTIFIER = /^[A-Z_$][\w$]*$/i
const WIDTH = 80

const ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  '\'': '\\\'',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
}

interface Style {
  indent: string
  semi: string
}

function style(config?: ContentConfig): Style {
  return {
    indent: ' '.repeat(config?.indent ?? 2),
    semi: config?.semi ? ';' : '',
  }
}

function unsafe(code: number): boolean {
  return code < 0x20 || (code >= 0x7F && code <= 0x9F) || code === 0x2028 || code === 0x2029
}

function string(value: string): string {
  let out = ''

  for (const char of value) {
    const escaped = ESCAPES[char]
    const code = char.charCodeAt(0)

    if (escaped !== undefined)
      out += escaped
    else if (unsafe(code))
      out += `\\u${code.toString(16).padStart(4, '0')}`
    else
      out += char
  }

  return `'${out}'`
}

function key(value: string): string {
  return IDENTIFIER.test(value) ? value : string(value)
}

function storable(input: unknown): boolean {
  return input !== undefined && input !== null && !(typeof input === 'number' && !Number.isFinite(input))
}

function value(input: unknown, style: Style, depth: number): string {
  if (typeof input === 'string')
    return string(input)

  if (typeof input === 'number')
    return String(input)

  if (typeof input === 'boolean')
    return String(input)

  const pad = style.indent.repeat(depth + 1)
  const close = style.indent.repeat(depth)

  if (Array.isArray(input)) {
    const kept = input.filter(storable)

    if (kept.length === 0)
      return '[]'

    const items = kept.map(item => value(item, style, depth + 1))
    const inline = `[${items.join(', ')}]`

    if (kept.every(item => typeof item !== 'object') && close.length + inline.length <= WIDTH)
      return inline

    return `[\n${items.map(item => `${pad}${item},`).join('\n')}\n${close}]`
  }

  const entries = Object.entries(input as Record<string, unknown>).filter(([, item]) => storable(item))
  if (entries.length === 0)
    return '{}'

  const lines = entries.map(([name, item]) => `${pad}${key(name)}: ${value(item, style, depth + 1)},`)
  return `{\n${lines.join('\n')}\n${close}}`
}

export function serializeSchema(schema: ForgePressSchema, config?: ContentConfig): string {
  const current = style(config)

  return [
    `import type { ForgePressSchema } from 'forgepress'${current.semi}`,
    '',
    `export default ${value(schema, current, 0)} as const satisfies ForgePressSchema${current.semi}`,
    '',
  ].join('\n')
}

function ordered(row: ContentRow): [string, unknown][] {
  const entries = Object.entries(row).filter(([, item]) => storable(item))
  const rank = (name: string): number => {
    const index = (META_KEYS as readonly string[]).indexOf(name)

    return index === -1 ? META_KEYS.length : index
  }

  return entries.sort(([left], [right]) => rank(left) - rank(right))
}

export function serializeEntry(collection: string, row: ContentRow, config?: ContentConfig): string {
  const current = style(config)

  const body = ordered(row)
    .map(([name, item]) => `${current.indent}${key(name)}: ${value(item, current, 1)},`)
    .join('\n')

  return [
    `import type { ForgePressEntry } from 'forgepress'${current.semi}`,
    '',
    `export default {\n${body}\n} satisfies ForgePressEntry<${string(collection)}>${current.semi}`,
    '',
  ].join('\n')
}
