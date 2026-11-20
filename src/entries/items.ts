import type { ComponentField } from '../schema'
import { itemComponent, items } from '../schema'
import { isRecord } from '../utils'

export interface ComponentItem {
  name: string
  item: Record<string, unknown>
}

export function componentItems(field: ComponentField, value: unknown, translated: boolean): ComponentItem[] {
  if (value === undefined)
    return []

  const values = translated && isRecord(value) ? Object.values(value) : [value]

  return values.flatMap(entry => items(entry, field.multiple)).flatMap((item) => {
    const name = itemComponent(field, item)

    return isRecord(item) && name !== undefined ? [{ name, item }] : []
  })
}
