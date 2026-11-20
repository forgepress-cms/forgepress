const PLACEHOLDER = /\{([\w$]+)\}/g

function plain(value: unknown): string | undefined {
  if (typeof value === 'string')
    return value === '' ? undefined : value

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined
}

export function previewPlaceholders(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(PLACEHOLDER), match => match[1]!))]
}

export function fillPreview(template: string, values: Readonly<Record<string, unknown>>): { path: string } | { missing: string[] } {
  const missing = previewPlaceholders(template).filter(name => plain(values[name]) === undefined)

  if (missing.length > 0)
    return { missing }

  return { path: template.replace(PLACEHOLDER, (_, name: string) => plain(values[name])!.split('/').map(encodeURIComponent).join('/')) }
}

export function renamePreviewField(template: string, from: string, to: string): string {
  return template.replaceAll(`{${from}}`, `{${to}}`)
}
