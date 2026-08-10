import type { ContentConfig } from '../types/config/content'
import type { ContentRow } from '../types/content/reader'
import type { WebenvSchema } from '../types/core/schema'

const IDENTIFIER = /^[A-Z_$][\w$]*$/i
const WIDTH = 80

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

function string(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n')}'`
}

function key(value: string): string {
  return IDENTIFIER.test(value) ? value : string(value)
}

function value(input: unknown, style: Style, depth: number): string {
  if (input === null || input === undefined)
    return 'undefined'

  if (typeof input === 'string')
    return string(input)

  if (typeof input === 'number' || typeof input === 'boolean')
    return String(input)

  const pad = style.indent.repeat(depth + 1)
  const close = style.indent.repeat(depth)

  if (Array.isArray(input)) {
    if (input.length === 0)
      return '[]'

    const items = input.map(item => value(item, style, depth + 1))
    const inline = `[${items.join(', ')}]`

    if (input.every(item => typeof item !== 'object') && close.length + inline.length <= WIDTH)
      return inline

    return `[\n${items.map(item => `${pad}${item},`).join('\n')}\n${close}]`
  }

  const entries = Object.entries(input as Record<string, unknown>).filter(([, item]) => item !== undefined)
  if (entries.length === 0)
    return '{}'

  const lines = entries.map(([name, item]) => `${pad}${key(name)}: ${value(item, style, depth + 1)},`)
  return `{\n${lines.join('\n')}\n${close}}`
}

export function serializeSchema(schema: WebenvSchema, config?: ContentConfig): string {
  const current = style(config)

  return [
    `import { defineWebenvSchema } from 'webenv'${current.semi}`,
    '',
    `export default defineWebenvSchema(${value(schema, current, 0)})${current.semi}`,
    '',
  ].join('\n')
}

export function serializeContent(component: string, rows: ContentRow[], config?: ContentConfig): string {
  const current = style(config)

  return [
    `import { defineWebenvContent } from 'webenv'${current.semi}`,
    '',
    `export default defineWebenvContent<${string(component)}>(${value(rows, current, 0)})${current.semi}`,
    '',
  ].join('\n')
}
