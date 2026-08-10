import type { ElementType } from '../elements'
import type { ContentRow } from '../types/content/reader'
import type { Component } from '../types/core/component'
import type { WebenvSchema } from '../types/core/schema'
import type { ComponentSummary, ElementSummary, RelationEdge, SchemaOverview } from '../types/schema'
import { toFileName } from '../content/paths'
import { collectIssues } from './issues'

export function targetsOf(element: ElementType): string[] {
  if (element.type === 'relation')
    return [element.component]

  if (element.type === 'dynamic')
    return [...element.components]

  return []
}

export function isMultiple(element: ElementType): boolean {
  return element.type === 'dynamic' || ('multiple' in element && element.multiple === true)
}

function summarizeElement(key: string, element: ElementType): ElementSummary {
  return {
    key,
    label: element.label ?? key,
    element,
    targets: targetsOf(element),
    translate: element.translate === true,
    optional: element.optional === true,
    multiple: isMultiple(element),
  }
}

function edgesOf(name: string, component: Component): RelationEdge[] {
  return Object.entries(component.elements).flatMap(([key, element]) =>
    targetsOf(element).map(to => ({
      from: name,
      to,
      element: key,
      kind: element.type === 'dynamic' ? 'dynamic' as const : 'relation' as const,
    })),
  )
}

function statusOf(rows: ContentRow[]): ComponentSummary['status'] {
  return {
    draft: rows.filter(row => row.status === 'draft').length,
    published: rows.filter(row => row.status === 'published').length,
    archived: rows.filter(row => row.status === 'archived').length,
  }
}

function latest(rows: ContentRow[]): string | undefined {
  return rows.map(row => row.updatedAt).sort().at(-1)
}

export function createSchemaOverview(schema: WebenvSchema, content: Record<string, ContentRow[]>): SchemaOverview {
  const components = Object.entries(schema.components) as [string, Component][]
  const edges = components.flatMap(([name, component]) => edgesOf(name, component))

  const summaries = components.map<ComponentSummary>(([name, component]) => {
    const rows = content[name] ?? []
    const elements = Object.entries(component.elements).map(([key, element]) => summarizeElement(key, element))
    const description = component.description
    const updatedAt = latest(rows)

    return {
      name,
      label: component.label ?? name,
      ...(description === undefined ? {} : { description }),
      file: toFileName(name),
      elements,
      references: edges.filter(edge => edge.from === name),
      referencedBy: edges.filter(edge => edge.to === name && edge.from !== name),
      rows: rows.length,
      status: statusOf(rows),
      translated: elements.filter(element => element.translate).length,
      optional: elements.filter(element => element.optional).length,
      ...(updatedAt === undefined ? {} : { updatedAt }),
    }
  })

  return {
    locales: [...schema.locales ?? []],
    components: summaries,
    edges,
    issues: collectIssues(schema, content),
    totals: {
      components: summaries.length,
      elements: summaries.reduce((total, component) => total + component.elements.length, 0),
      rows: summaries.reduce((total, component) => total + component.rows, 0),
      relations: edges.length,
    },
  }
}
