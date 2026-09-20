import type { Entry } from '../entries/types'
import type { Conversion } from '../migrate/convert'
import type { Field } from '../schema/fields'
import type { Component, ForgePressSchema } from '../schema/types'
import { META_KEYS } from '../entries/meta'
import { convertField, sameComponents } from '../migrate/convert'
import { leaves } from '../migrate/plan'
import { defaultLocale } from '../schema/locales'
import { same } from '../utils/value'

export interface Adapted {
  entry: Entry
  dropped: string[]
  conflicts: string[]
}

const META: ReadonlySet<string> = new Set(META_KEYS)

function conversion(locales: readonly string[], chosen: string | undefined, components: Readonly<Record<string, Component>> | undefined): Conversion {
  return {
    links: {
      collection: name => name,
      exists: () => true,
      title: () => undefined,
      match: () => undefined,
      holder: () => undefined,
      unmatched: () => undefined,
    },
    locales: { before: locales, after: locales, defaults: { before: chosen, after: chosen }, rename: locale => locale, source: locale => locale },
    components: sameComponents(components),
  }
}

function later(left: string, right: string): string {
  return left > right ? left : right
}

export function adaptEntry(pending: Entry, schema: ForgePressSchema, collection: string, base?: Entry, head?: Entry): Adapted {
  const fields: Readonly<Record<string, Field>> = schema.collections[collection]?.fields ?? {}
  const context = conversion(schema.locales ?? [], defaultLocale(schema), schema.components)
  const fit = (value: unknown, field: Field): unknown => value === undefined ? undefined : convertField(value, undefined, field, context)
  const renamed = new Map<string, string>()

  for (const [key, field] of Object.entries(fields)) {
    if (!base || !head || base[key] !== undefined || head[key] === undefined)
      continue

    const from = Object.keys(base).find(old => !META.has(old) && !fields[old] && same(fit(base[old], field), head[key]))

    if (from !== undefined)
      renamed.set(key, from)
  }

  const read = (entry: Entry, key: string): unknown => entry[key] ?? (renamed.has(key) ? entry[renamed.get(key)!] : undefined)
  const moved = new Set(renamed.values())
  const next: Record<string, unknown> = { ...head ?? {}, id: pending.id, status: pending.status, createdAt: head?.createdAt ?? pending.createdAt, updatedAt: head ? later(pending.updatedAt, head.updatedAt) : pending.updatedAt }
  const conflicts: string[] = []

  if (base && head && same(pending.status, base.status))
    next.status = head.status

  for (const [key, field] of Object.entries(fields)) {
    const mine = fit(read(pending, key), field)

    if (base && head) {
      const theirs = head[key]
      const original = fit(read(base, key), field)

      if (same(mine, original) || same(mine, theirs))
        continue

      if (!same(theirs, original))
        conflicts.push(key)
    }

    if (mine === undefined)
      delete next[key]
    else
      next[key] = mine
  }

  const dropped = Object.keys(pending).filter(key => !META.has(key) && !fields[key] && !moved.has(key) && leaves(pending[key]) > 0 && !(base && same(pending[key], base[key])))

  return { entry: next as Entry, dropped, conflicts }
}
