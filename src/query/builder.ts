import type { EntryRef } from '../entries/types'
import type { LinkedFields, LinkItems, LinkTarget, OutputEntry, OutputManifest } from '../output/types'
import type { ContentLoader, Snapshot } from './client'
import type { Operator, Picks, QueryPlan } from './types'
import { OUTPUT_META_KEYS } from '../entries/meta'
import { entryKey, isEntryRef } from '../entries/references'
import { COMPONENT_KEY, items, mapItems, onlyName } from '../schema/fields/picked'
import { isRecord, pick, quote } from '../utils/value'
import { evaluate } from './evaluator'

type Components = Readonly<Record<string, LinkedFields>>

function refsOf(value: unknown): EntryRef[] {
  return (Array.isArray(value) ? value : [value]).filter(isEntryRef)
}

interface Continued {
  collection: string
  path: string
}

function isItems(target: LinkTarget): target is LinkItems {
  return 'components' in target
}

function itemFields(target: LinkItems, item: unknown, components: Components): LinkedFields | undefined {
  const tag = onlyName(target.components) ?? (isRecord(item) ? item[COMPONENT_KEY] : undefined)

  return typeof tag === 'string' ? components[tag] : undefined
}

function linkedValue(value: unknown, target: LinkTarget, components: Components, find: (ref: EntryRef) => OutputEntry | undefined, picks: Picks | undefined): unknown {
  if (!isItems(target)) {
    const tagged = target.collections.length !== 1
    const found = refsOf(value).flatMap((ref) => {
      const loaded = find(ref)

      if (loaded === undefined)
        return []

      const fields = picks?.[ref.collection]
      const entry = fields === undefined ? loaded : pick(loaded, fields)

      return [tagged ? { collection: ref.collection, id: ref.id, entry } : entry]
    })

    return target.multiple ? found : found[0]
  }

  return mapItems(value, target.multiple, (item) => {
    const fields = itemFields(target, item, components)

    if (!isRecord(item) || fields === undefined)
      return item

    return Object.fromEntries(Object.entries(item).map(([key, inner]) => {
      const nested = fields[key]

      return [key, nested === undefined || inner === undefined ? inner : linkedValue(inner, nested, components, find, picks)]
    }))
  })
}

function refsIn(value: unknown, target: LinkTarget, components: Components): EntryRef[] {
  if (!isItems(target))
    return refsOf(value)

  return items(value, target.multiple).flatMap((item) => {
    const fields = itemFields(target, item, components)

    if (!isRecord(item) || fields === undefined)
      return []

    return Object.entries(fields).flatMap(([key, nested]) => item[key] === undefined ? [] : refsIn(item[key], nested, components))
  })
}

function split(path: string): [string, string] {
  const [field = '', ...deeper] = path.split('.')

  return [field, deeper.join('.')]
}

function inner(target: LinkItems, field: string, components: Components): LinkTarget[] {
  return target.components.flatMap(name => components[name]?.[field] ?? [])
}

function continued(target: LinkTarget, path: string, components: Components): Continued[] {
  if (path === '')
    return []

  if (!isItems(target))
    return target.collections.map(collection => ({ collection, path }))

  const [field, rest] = split(path)

  return inner(target, field, components).flatMap(nested => continued(nested, rest, components))
}

function unfollowed(target: LinkTarget, path: string, components: Components): string | undefined {
  if (path === '' || !isItems(target))
    return undefined

  const [field, rest] = split(path)
  const nested = inner(target, field, components)

  if (nested.length === 0)
    return field

  const stopped = nested.map(inside => unfollowed(inside, rest, components))

  return stopped.includes(undefined) ? undefined : stopped[0]
}

function listing(names: readonly string[]): string {
  return names.map(quote).join(', ')
}

export class Builder {
  private readonly plan: QueryPlan = { where: [], sort: [], offset: 0, with: [] }
  private readonly called = new Set<string>()
  private keep: Picks | undefined
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

  private once(step: string, hint: string): void {
    if (this.called.has(step))
      throw new Error(`[forgepress] query(${quote(this.collection)}) calls .${step}() twice; ${hint}`)

    this.called.add(step)
  }

  with(...paths: readonly (string | Picks)[]): this {
    this.once('with', 'name every path in one call, such as .with("author", "category")')

    this.plan.with = [...new Set(paths.filter(path => typeof path === 'string'))]
    this.keep = paths.find(path => typeof path !== 'string')

    return this
  }

  pick(...fields: string[]): this {
    this.once('pick', 'name every field in one call, such as .pick("title", "slug")')

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
    const listed = new Set<string>([...OUTPUT_META_KEYS, ...manifest.indexed])
    const unindexed = [...new Set([...plan.where, ...plan.sort].map(clause => clause.field))].filter(field => !listed.has(field))

    if (unindexed.length > 0 && index.dev)
      console.warn(`[forgepress] query(${quote(collection)}) filters or sorts by ${listing(unindexed)}, which ${unindexed.length === 1 ? 'is' : 'are'} not indexed, so every entry is loaded. Add index: true to ${unindexed.length === 1 ? 'the field' : 'the fields'} in the schema`)

    const candidates = unindexed.length > 0 ? await snapshot.entries(collection, locale, manifest.entries.map(entry => entry.id)) : manifest.entries
    const selected = evaluate(candidates, limit === undefined ? plan : { ...plan, limit: Math.min(plan.limit ?? limit, limit) })
    const listedOnly = plan.pick !== undefined && [...plan.pick, ...plan.with.map(path => split(path)[0])].every(field => listed.has(field))
    const rows = unindexed.length > 0 || listedOnly ? selected : await snapshot.entries(collection, locale, selected.map(entry => entry.id))
    const linked = plan.with.length > 0 ? await this.link(snapshot, collection, manifest, rows, plan.with) : rows
    const fields = plan.pick
    const picked = fields === undefined ? linked : linked.map(row => pick(row, fields) as OutputEntry)

    return structuredClone(picked)
  }

  private targets(collection: string, manifest: OutputManifest, paths: readonly string[]): Map<string, LinkTarget> {
    const components = manifest.components ?? {}
    const found = new Map<string, LinkTarget>()

    for (const path of paths) {
      const [field, rest] = split(path)
      const target = manifest.links[field]

      if (target === undefined)
        throw new Error(`[forgepress] .with(${quote(path)}) loads fields that link to entries, and ${quote(field)} is not one in ${quote(collection)}`)

      const stop = unfollowed(target, rest, components)

      if (stop !== undefined)
        throw new Error(`[forgepress] .with(${quote(path)}) stops at ${quote(stop)}, which does not link to entries`)

      found.set(field, target)
    }

    return found
  }

  private async linked(snapshot: Snapshot, collection: string, ids: ReadonlySet<string>, fields: ReadonlySet<string> | undefined): Promise<OutputEntry[]> {
    if (fields !== undefined) {
      const manifest = await snapshot.manifest(collection, this.chosen)
      const listed = new Set<string>([...OUTPUT_META_KEYS, ...manifest.indexed])

      if ([...fields].every(field => listed.has(field)))
        return manifest.entries.filter(entry => ids.has(entry.id))
    }

    return snapshot.entries(collection, this.chosen, [...ids])
  }

  private async link(snapshot: Snapshot, collection: string, manifest: OutputManifest, rows: readonly OutputEntry[], paths: readonly string[]): Promise<OutputEntry[]> {
    const { index } = snapshot
    const { chosen: locale, keep } = this
    const components = manifest.components ?? {}
    const targets = this.targets(collection, manifest, paths)
    const wanted = new Map<string, Set<string>>()
    const kept = new Map<string, Set<string>>()
    const whole = new Set<string>()

    for (const [field, target] of targets) {
      for (const ref of rows.flatMap(row => refsIn(row[field], target, components))) {
        if (index.collections[ref.collection]?.localized && locale === undefined)
          throw this.needsLocale(snapshot, `.with(${quote(field)}) loads ${quote(ref.collection)} entries, which are translated`)

        const picked = keep?.[ref.collection]

        wanted.set(ref.collection, (wanted.get(ref.collection) ?? new Set()).add(ref.id))

        if (picked === undefined)
          whole.add(ref.collection)
        else
          kept.set(ref.collection, new Set([...kept.get(ref.collection) ?? [], ...picked]))
      }
    }

    const onward = new Map<string, Set<string>>()

    for (const path of paths) {
      const [field, rest] = split(path)

      for (const step of continued(targets.get(field)!, rest, components)) {
        onward.set(step.collection, (onward.get(step.collection) ?? new Set()).add(step.path))
        whole.add(step.collection)
      }
    }

    const loaded = new Map<string, OutputEntry>()

    await Promise.all([...wanted].map(async ([name, ids]) => {
      for (const entry of await this.linked(snapshot, name, ids, whole.has(name) ? undefined : kept.get(name)))
        loaded.set(entryKey(name, entry.id), entry)
    }))

    await Promise.all([...onward].map(async ([name, deeper]) => {
      const held = [...wanted.get(name) ?? []].flatMap(id => loaded.get(entryKey(name, id)) ?? [])

      if (held.length === 0)
        return

      const linking = await snapshot.manifest(name, locale)
      const known = [...deeper].filter(path => linking.links[split(path)[0]] !== undefined)

      if (known.length === 0)
        return

      for (const entry of await this.link(snapshot, name, linking, held, known))
        loaded.set(entryKey(name, entry.id), entry)
    }))

    const find = (ref: EntryRef): OutputEntry | undefined => loaded.get(entryKey(ref.collection, ref.id))

    return rows.map((row) => {
      const next: OutputEntry = { ...row }

      for (const [field, target] of targets) {
        const value = row[field]

        if (value !== undefined)
          next[field] = linkedValue(value, target, components, find, keep)
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
