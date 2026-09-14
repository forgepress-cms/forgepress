export function moveItem<TItem>(items: TItem[], from: number, offset: number): TItem[] {
  const to = from + offset

  if (from < 0 || from >= items.length || to < 0 || to >= items.length)
    return items

  const moved = [...items]

  moved.splice(to, 0, ...moved.splice(from, 1))

  return moved
}

export function moveKey<TValue>(record: Record<string, TValue>, key: string, offset: number): Record<string, TValue> {
  const keys = Object.keys(record)
  const moved = moveItem(keys, keys.indexOf(key), offset)

  return moved === keys ? record : Object.fromEntries(moved.map(name => [name, record[name]!]))
}
