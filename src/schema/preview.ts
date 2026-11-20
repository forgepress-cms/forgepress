import type { PreviewAddress } from './types'

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

export function previewTemplate(preview: PreviewAddress | undefined, locale: string | undefined): string | undefined {
  if (typeof preview !== 'object')
    return preview || undefined

  return locale !== undefined && Object.hasOwn(preview, locale) ? preview[locale] || undefined : undefined
}

export function renamePreviewField(preview: PreviewAddress, from: string, to: string): PreviewAddress {
  const rename = (template: string): string => template.replaceAll(`{${from}}`, `{${to}}`)

  return typeof preview === 'string' ? rename(preview) : Object.fromEntries(Object.entries(preview).map(([locale, template]) => [locale, rename(template)]))
}
