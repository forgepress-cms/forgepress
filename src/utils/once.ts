export function keyed<TValue>(): (key: string, load: () => Promise<TValue>) => Promise<TValue> {
  const pending = new Map<string, Promise<TValue>>()

  return (key, load) => {
    const found = pending.get(key)

    if (found)
      return found

    const loading = load()

    pending.set(key, loading)
    loading.catch(() => pending.delete(key))

    return loading
  }
}

export function once<TValue>(load: () => Promise<TValue>): () => Promise<TValue> {
  const loads = keyed<TValue>()

  return () => loads('', load)
}
