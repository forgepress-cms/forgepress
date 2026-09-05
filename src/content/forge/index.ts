import type { ContentConfig } from '../../types/config/content'
import type { ProviderConfig, ProviderType } from '../../types/config/provider'
import type { Draft } from '../../types/content/draft'
import type { FileChange, ForgeDescriptor } from '../../types/content/forge'
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

const ROOTS: Record<ProviderType, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
  forgejo: 'https://codeberg.org',
}

export function describe(config: ProviderConfig): ForgeDescriptor {
  const root = (config.url ?? ROOTS[config.type]).replace(/\/+$/, '')

  if (config.type === 'github') {
    return {
      root,
      api: root === ROOTS.github ? 'https://api.github.com' : `${root}/api/v3`,
      scopes: config.scopes ?? [],
    }
  }

  if (config.type === 'gitlab') {
    return {
      root,
      api: `${root}/api/v4`,
      scopes: config.scopes ?? ['api'],
      oauth: { authorize: `${root}/oauth/authorize`, token: `${root}/oauth/token` },
    }
  }

  return {
    root,
    api: `${root}/api/v1`,
    scopes: config.scopes ?? ['read:user', 'write:repository'],
    oauth: { authorize: `${root}/login/oauth/authorize`, token: `${root}/login/oauth/access_token` },
  }
}

export function textToBase64(text: string): string {
  return toBase64(new TextEncoder().encode(text).buffer as ArrayBuffer)
}

export function commitMessage(template: string | undefined, name: string): string {
  const trimmed = name.trim()

  if (!template)
    return trimmed || 'Update content'

  return template.includes('{name}')
    ? template.replace('{name}', trimmed || 'update content')
    : `${template} ${trimmed}`.trim()
}

export function prefixer(base?: string): (path: string) => string {
  const prefix = base?.replace(/^\/+|\/+$/g, '') ?? ''

  return path => prefix ? `${prefix}/${path}` : path
}

export interface PublishTarget {
  mediaDir: string
  base?: string | undefined
  format?: ContentConfig | undefined
}

export function toFiles(draft: Draft, target: PublishTarget): FileChange[] {
  const files: FileChange[] = []

  const at = prefixer(target.base)

  if (draft.schema !== undefined)
    files.push({ path: at(SCHEMA_FILE), data: serializeSchema(draft.schema, target.format), encoding: 'utf-8' })

  for (const [component, rows] of Object.entries(draft.components)) {
    const path = at(`${CONTENT_DIR}/${toFileName(component)}`)

    if (rows === null)
      files.push({ path, removed: true })
    else
      files.push({ path, data: serializeContent(component, rows, target.format), encoding: 'utf-8' })
  }

  for (const upload of Object.values(draft.uploads))
    files.push({ path: at(`${target.mediaDir}/${upload.name}`), data: toBase64(upload.data), encoding: 'base64' })

  for (const name of draft.removed)
    files.push({ path: at(`${target.mediaDir}/${name}`), removed: true })

  return files
}
