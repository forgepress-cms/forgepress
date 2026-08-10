import type { ElementType } from '../elements'
import type { ContentRow } from '../types/content/reader'
import type { Component } from '../types/core/component'
import type { WebenvSchema } from '../types/core/schema'
import type { SchemaIssue } from '../types/schema'

function relationIds(value: unknown): string[] {
  if (typeof value === 'string')
    return [value]

  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === 'string')

  return []
}

function missingLocales(value: unknown, locales: readonly string[]): string[] {
  if (value === null || typeof value !== 'object')
    return [...locales]

  return locales.filter(locale => (value as Record<string, unknown>)[locale] === undefined)
}

function elementIssues(
  component: string,
  key: string,
  element: ElementType,
  rows: ContentRow[],
  known: Set<string>,
  ids: Map<string, Set<string>>,
  locales: readonly string[],
): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const targets = element.type === 'relation'
    ? [element.component]
    : element.type === 'dynamic' ? element.components : []

  for (const target of targets) {
    if (!known.has(target))
      issues.push({ level: 'error', component, element: key, message: `references unknown component "${target}"` })
  }

  if (element.label === undefined)
    issues.push({ level: 'warning', component, element: key, message: 'has no label, the editor falls back to the key' })

  const present = rows.filter(row => row[key] !== undefined)

  if (element.optional !== true && present.length !== rows.length)
    issues.push({ level: 'error', component, element: key, message: `missing in ${rows.length - present.length} of ${rows.length} rows but not optional` })

  if (element.type === 'relation') {
    const pool = ids.get(element.component)
    const dangling = present.flatMap(row => relationIds(row[key])).filter(id => pool !== undefined && !pool.has(id))

    if (dangling.length > 0)
      issues.push({ level: 'error', component, element: key, message: `points at missing ${element.component} rows: ${[...new Set(dangling)].join(', ')}` })
  }

  if (element.translate === true && locales.length > 0) {
    const missing = new Set(present.flatMap(row => missingLocales(row[key], locales)))

    if (missing.size > 0)
      issues.push({ level: 'warning', component, element: key, message: `is untranslated for ${[...missing].join(', ')}` })
  }

  return issues
}

export function collectIssues(schema: WebenvSchema, content: Record<string, ContentRow[]>): SchemaIssue[] {
  const components = Object.entries(schema.components) as [string, Component][]
  const known = new Set(components.map(([name]) => name))
  const locales = schema.locales ?? []
  const ids = new Map(components.map(([name]) => [name, new Set((content[name] ?? []).map(row => row.id))]))

  return components.flatMap(([name, component]) => {
    const rows = content[name] ?? []
    const issues: SchemaIssue[] = rows.length === 0
      ? [{ level: 'warning', component: name, message: 'has no content yet' }]
      : []

    return [
      ...issues,
      ...Object.entries(component.elements).flatMap(([key, element]) =>
        elementIssues(name, key, element, rows, known, ids, locales),
      ),
    ]
  })
}
