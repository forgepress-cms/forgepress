import type { Field } from '../schema/fields'
import type { Entry } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import type { Operator, QueryBackend, QueryPlan } from './types'
import { evaluate, localize } from './evaluator'

type Fields = Record<string, Field>

function collectionFields(schema: ForgePressSchema, collection: string): Fields {
  return schema.collections[collection]?.fields ?? {}
}

function translatedFields(fields: Fields): Set<string> {
  return new Set(Object.keys(fields).filter(field => fields[field]?.translate))
}

class Builder {
  private readonly plan: QueryPlan = { where: [], sort: [], offset: 0 }
  private readonly relations: string[] = []

  constructor(private readonly collection: string, private readonly backend: QueryBackend) {}

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

  private async run(): Promise<Entry[]> {
    const [rows, schema] = await Promise.all([
      this.backend.source.list(this.collection),
      this.backend.source.schema(),
    ])

    const fields = collectionFields(schema, this.collection)
    let result = evaluate(rows, this.plan, translatedFields(fields))

    if (this.relations.length)
      result = await this.resolve(result, schema, fields)

    const { pick } = this.plan
    if (pick)
      result = result.map(row => Object.fromEntries(pick.map(field => [field, row[field]])) as Entry)

    return result
  }

  private async resolve(rows: Entry[], schema: ForgePressSchema, fields: Fields): Promise<Entry[]> {
    const resolved = rows.map(row => ({ ...row }))

    for (const field of this.relations) {
      const config = fields[field]
      if (config?.type !== 'relation' || !config.collection)
        continue

      const target = config.collection
      const related = translatedFields(collectionFields(schema, target))
      const locale = this.plan.locale
      const fetch = async (id: string): Promise<Entry | undefined> => {
        const row = await this.backend.source.entry(target, id)
        return row && locale ? localize(row, related, locale) : row
      }

      await Promise.all(resolved.map(async (row) => {
        const reference = row[field]
        row[field] = config.multiple
          ? (await Promise.all((reference as string[] ?? []).map(fetch))).filter(Boolean)
          : await fetch(reference as string)
      }))
    }

    return resolved
  }

  async first(): Promise<Entry | undefined> {
    return (await this.run())[0]
  }

  then<TResult1 = Entry[], TResult2 = never>(
    onFulfilled?: ((value: Entry[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onFulfilled, onRejected)
  }

  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<Entry[] | TResult> {
    return this.run().catch(onRejected)
  }

  finally(onFinally?: (() => void) | null): Promise<Entry[]> {
    return this.run().finally(onFinally)
  }

  get [Symbol.toStringTag](): string {
    return 'ForgePressQuery'
  }
}

export function createBuilder(collection: string, backend: QueryBackend): Builder {
  return new Builder(collection, backend)
}
