import type { EntryRef } from '../entries/types'
import type { OutputEntry, OutputManifest } from '../output/types'
import type { ContentLoader, Snapshot } from './client'
import type { Operator, QueryPlan } from './types'
import { OUTPUT_META_KEYS } from '../entries/meta'
import { entryKey, isEntryRef } from '../entries/references'
import { pick, quote } from '../utils/value'
import { evaluate } from './evaluator'

function refsOf(value: unknown): EntryRef[] {
  return (Array.isArray(value) ? value : [value]).filter(isEntryRef)
}

function listing(names: readonly string[]): string {
  return names.map(quote).join(', ')
}

export class Builder {
  private readonly plan: QueryPlan = { where: [], sort: [], offset: 0, with: [] }
  private chosen: string | undefined

  constructor(private readonly loader: ContentLoader, private readonly collection: string) {}

  where(field: string, operatorOrValue: unknown, value?: unknown): this {
    this.plan.where.push(arguments.length >= 3
      ? { field, op: operatorOrValue as Operator, value }
      : { field, op: 'eq', value: operatorOrValue })

    return this
  }

  sort(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.plan.sort.push({ field, dir: direction })

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
    this.chosen = locale

    return this
  }

  with(field: string): this {
    if (!this.plan.with.includes(field))
      this.plan.with.push(field)

    return this
  }

  pick(...fields: string[]): this {
    this.plan.pick = fields

    return this
  }

  private needsLocale(snapshot: Snapshot, reason: string): Error {
    const example = snapshot.index.locales[0] ?? 'en'

    return new Error(`[forgepress] ${reason}, so query(${quote(this.collection)}) needs .locale(), such as .locale(${quote(example)})`)
  }

  private async select(snapshot: Snapshot, limit?: number): Promise<OutputEntry[]> {
    const { index } = snapshot
    const { collection, chosen: locale, plan } = this
    const found = index.collections[collection]

    if (!found)
      throw new Error(`[forgepress] the content output has no collection ${quote(collection)}`)

    if (locale !== undefined && !index.locales.includes(locale))
      throw new Error(`[forgepress] ${quote(locale)} is not a locale of this site; ${index.locales.length > 0 ? `use ${listing(index.locales)}` : 'it has none'}`)

    if (found.localized && locale === undefined)
      throw this.needsLocale(snapshot, `${quote(collection)} is translated`)

    const manifest = await snapshot.manifest(collection, locale)
    const unlinked = plan.with.filter(field => manifest.links[field] === undefined)

    if (unlinked.length > 0)
      throw new Error(`[forgepress] .with() loads relation and dynamic fields, and ${listing(unlinked)} ${unlinked.length === 1 ? 'is not one' : 'are not'} in ${quote(collection)}`)

    const listed = new Set<string>([...OUTPUT_META_KEYS, ...manifest.indexed])
    const unindexed = [...new Set([...plan.where, ...plan.sort].map(clause => clause.field))].filter(field => !listed.has(field))

    if (unindexed.length > 0 && index.dev)
      console.warn(`[forgepress] query(${quote(collection)}) filters or sorts by ${listing(unindexed)}, which ${unindexed.length === 1 ? 'is' : 'are'} not indexed, so every entry is loaded. Add index: true to ${unindexed.length === 1 ? 'the field' : 'the fields'} in the schema`)

    const candidates = unindexed.length > 0 ? await snapshot.entries(collection, locale, manifest.entries.map(entry => entry.id)) : manifest.entries
    const selected = evaluate(candidates, limit === undefined ? plan : { ...plan, limit: Math.min(plan.limit ?? limit, limit) })
    const listedOnly = plan.pick !== undefined && [...plan.pick, ...plan.with].every(field => listed.has(field))
    const rows = unindexed.length > 0 || listedOnly ? selected : await snapshot.entries(collection, locale, selected.map(entry => entry.id))
    const linked = plan.with.length > 0 ? await this.link(snapshot, manifest, rows) : rows
    const fields = plan.pick
    const picked = fields === undefined ? linked : linked.map(row => pick(row, fields) as OutputEntry)

    return structuredClone(picked)
  }

  private async link(snapshot: Snapshot, manifest: OutputManifest, rows: readonly OutputEntry[]): Promise<OutputEntry[]> {
    const { index } = snapshot
    const locale = this.chosen
    const wanted = new Map<string, Set<string>>()

    for (const field of this.plan.with) {
      for (const ref of rows.flatMap(row => refsOf(row[field]))) {
        if (index.collections[ref.collection]?.localized && locale === undefined)
          throw this.needsLocale(snapshot, `.with(${quote(field)}) loads ${quote(ref.collection)} entries, which are translated`)

        wanted.set(ref.collection, (wanted.get(ref.collection) ?? new Set()).add(ref.id))
      }
    }

    const loaded = new Map<string, OutputEntry>()

    await Promise.all([...wanted].map(async ([collection, ids]) => {
      for (const entry of await snapshot.entries(collection, locale, [...ids]))
        loaded.set(entryKey(collection, entry.id), entry)
    }))

    const find = (ref: EntryRef): OutputEntry | undefined => loaded.get(entryKey(ref.collection, ref.id))

    return rows.map((row) => {
      const next: OutputEntry = { ...row }

      for (const field of this.plan.with) {
        const value = row[field]

        if (value === undefined)
          continue

        if (manifest.links[field] === 'dynamic')
          next[field] = refsOf(value).flatMap(ref => [find(ref)].flatMap(entry => entry ? [{ collection: ref.collection, id: ref.id, entry }] : []))
        else if (Array.isArray(value))
          next[field] = refsOf(value).flatMap(ref => find(ref) ?? [])
        else
          next[field] = refsOf(value).map(find)[0]
      }

      return next
    })
  }

  private execute(limit?: number): Promise<OutputEntry[]> {
    return this.loader.run(snapshot => this.select(snapshot, limit))
  }

  async first(): Promise<OutputEntry | undefined> {
    return (await this.execute(1))[0]
  }

  then<TResult1 = OutputEntry[], TResult2 = never>(
    onFulfilled?: ((value: OutputEntry[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onFulfilled, onRejected)
  }

  catch<TResult = never>(onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<OutputEntry[] | TResult> {
    return this.execute().catch(onRejected)
  }

  finally(onFinally?: (() => void) | null): Promise<OutputEntry[]> {
    return this.execute().finally(onFinally)
  }

  get [Symbol.toStringTag](): string {
    return 'ForgePressQuery'
  }
}
