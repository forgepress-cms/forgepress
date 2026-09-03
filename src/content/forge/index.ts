import type { ContentConfig } from '../../types/config/content'
import type { FileChange } from '../../types/content/forge'
import type { StoredMedia } from '../../types/content/media'
import type { StoredChanges } from '../../types/content/store'
import { CONTENT_DIR, SCHEMA_FILE, toFileName } from '../paths'
import { serializeContent, serializeSchema } from '../serialize'

const CHUNK = 0x8000

export function toBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  const parts: string[] = []

  for (let offset = 0; offset < bytes.length; offset += CHUNK)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + CHUNK)))

  return btoa(parts.join(''))
}

export function commitMessage(template: string | undefined, name: string): string {
  const trimmed = name.trim()

  if (!template)
    return trimmed || 'Update content'

  return template.includes('{name}')
    ? template.replace('{name}', trimmed || 'update content')
    : `${template} ${trimmed}`.trim()
}

export interface PublishTarget {
  mediaDir: string
  base?: string | undefined
  format?: ContentConfig | undefined
}

export function toFiles(changes: StoredChanges, media: StoredMedia, target: PublishTarget): FileChange[] {
  const files: FileChange[] = []

  const prefix = target.base?.replace(/^\/+|\/+$/g, '') ?? ''
  const at = (path: string): string => prefix ? `${prefix}/${path}` : path

  if (changes.schema !== undefined)
    files.push({ path: at(SCHEMA_FILE), data: serializeSchema(changes.schema, target.format), encoding: 'utf-8' })

  for (const [component, rows] of Object.entries(changes.components)) {
    const path = at(`${CONTENT_DIR}/${toFileName(component)}`)

    if (rows === null)
      files.push({ path, removed: true })
    else
      files.push({ path, data: serializeContent(component, rows, target.format), encoding: 'utf-8' })
  }

  for (const upload of Object.values(media.uploads))
    files.push({ path: at(`${target.mediaDir}/${upload.name}`), data: toBase64(upload.data), encoding: 'base64' })

  for (const name of media.removed)
    files.push({ path: at(`${target.mediaDir}/${name}`), removed: true })

  return files
}
