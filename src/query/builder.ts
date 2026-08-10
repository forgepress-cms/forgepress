import type { ContentRow } from '../types/content/reader'
import type { WebenvSchema } from '../types/core/schema'
import type { Operator, QueryBackend, QueryPlan } from '../types/query'
import { evaluate, localize } from './evaluator'

interface ElementMeta { type?: string, translate?: boolean, component?: string, multiple?: boolean }

function componentElements(schema: WebenvSchema, component: string): Record<string, ElementMeta> {
  return (schema.components[component]?.elements ?? {}) as Record<string, ElementMeta>
}

function translatedFields(elements: Record<string, ElementMeta>): Set<string> {
  return new Set(Object.keys(elements).filter(field => elements[field]?.translate))
}

class Builder {
  private readonly plan: QueryPlan = { where: [], sort: [], offset: 0 }
  private readonly relations: string[] = []

  constructor(private readonly component: string, private readonly backend: QueryBackend) {}

  where(field: string, opOrValue: unknown, value?: unknown): this {
    const clause = arguments.length >= 3
      ? { field, op: opOrValue as Operator, value }
      : { field, op: 'eq' as Operator, value: opOrValue }
    this.plan.where.push(clause)
    return this
  }

  sort(field: string, dir: 'asc' | 'desc' = 'asc'): this {
    this.plan.sort.push({ field, dir })
    return this
  }

  limit(count: number): this {
    this.plan.limit = count
    return this
  }

  offset(count: number): this {
    this.plan.offset = count
    return this
  }

  locale(locale: string): this {
    this.plan.locale = locale
    return this
  }

  with(field: string): this {
    this.relations.push(field)
    return this
  }

  pick(...fields: string[]): this {
    this.plan.pick = fields
    return this
  }

  private async run(): Promise<ContentRow[]> {
    const [rows, schema] = await Promise.all([
      this.backend.reader.list(this.component),
      this.backend.schema(),
    ])

    const elements = componentElements(schema, this.component)
    let result = evaluate(rows, this.plan, translatedFields(elements))

    if (this.relations.length)
      result = await this.resolve(result, schema, elements)

    const { pick } = this.plan
    if (pick)
      result = result.map(row => Object.fromEntries(pick.map(field => [field, row[field]])) as ContentRow)

    return result
  }

  private async resolve(rows: ContentRow[], schema: WebenvSchema, elements: Record<string, ElementMeta>): Promise<ContentRow[]> {
    const resolved = rows.map(row => ({ ...row }))

    for (const field of this.relations) {
      const element = elements[field]
      if (element?.type !== 'relation' || !element.component)
        continue

      const related = translatedFields(componentElements(schema, element.component))
      const locale = this.plan.locale
      const fetch = async (id: string): Promise<ContentRow | undefined> => {
        const row = await this.backend.reader.get(element.component!, id)
        return row && locale ? localize(row, related, locale) : row
      }

      await Promise.all(resolved.map(async (row) => {
        const reference = row[field]
        row[field] = element.multiple
          ? (await Promise.all((reference as string[] ?? []).map(fetch))).filter(Boolean)
          : await fetch(reference as string)
      }))
    }

    return resolved
  }

  async first(): Promise<ContentRow | undefined> {
    return (await this.run())[0]
  }

  then<TResult1 = ContentRow[], TResult2 = never>(
    onFulfilled?: ((value: ContentRow[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onFulfilled, onRejected)
  }

  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<ContentRow[] | TResult> {
    return this.run().catch(onRejected)
  }

  finally(onFinally?: (() => void) | null): Promise<ContentRow[]> {
    return this.run().finally(onFinally)
  }

  get [Symbol.toStringTag](): string {
    return 'WebenvQuery'
  }
}

export function createBuilder(component: string, backend: QueryBackend): Builder {
  return new Builder(component, backend)
}
