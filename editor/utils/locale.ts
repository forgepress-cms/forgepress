const names = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })

export function localeName(code: string): string | undefined {
  try {
    return names.of(code)
  }
  catch {
    return undefined
  }
}
