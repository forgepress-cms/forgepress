export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}

export function readLocalJson<TValue>(key: string): TValue | undefined {
  const text = readLocal(key)

  try {
    return text ? JSON.parse(text) as TValue : undefined
  }
  catch {
    return undefined
  }
}

export function writeLocal(key: string, value: string | undefined): void {
  try {
    if (value === undefined)
      localStorage.removeItem(key)
    else
      localStorage.setItem(key, value)
  }
  catch {
  }
}
