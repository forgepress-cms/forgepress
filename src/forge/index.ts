import type { Changes } from '../changes/types'
import type { ProviderConfig, ProviderType } from '../types/config'
import type { FileChange, ForgeDescriptor, RepoTarget } from './types'
import { prefixer } from '../files/paths'
import { serializeEntry, serializeSchema } from '../files/serialize'

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

export function base64ToBytes(data: string): Uint8Array {
  return Uint8Array.from(atob(data.replace(/\s/g, '')), char => char.charCodeAt(0))
}

export function base64ToText(data: string): string {
  return new TextDecoder().decode(base64ToBytes(data))
}

export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export function commitMessage(template: string | undefined, name: string): string {
  const trimmed = name.trim()

  if (!template)
    return trimmed || 'Update content'

  return template.includes('{name}')
    ? template.replace('{name}', trimmed || 'update content')
    : `${template} ${trimmed}`.trim()
}

function replacing(hash: string | null | undefined): { replaces?: string | null } {
  return hash === undefined ? {} : { replaces: hash }
}

export function toFiles(changes: Changes, target: RepoTarget): FileChange[] {
  const files: FileChange[] = []

  const at = prefixer(target.base)

  if (changes.schema !== undefined)
    files.push({ path: at(target.paths.schema), data: serializeSchema(changes.schema, target.format), encoding: 'utf-8', ...replacing(changes.hashes?.schema) })

  for (const [collection, overlay] of Object.entries(changes.entries)) {
    for (const [id, row] of Object.entries(overlay)) {
      const path = at(target.paths.entry(collection, id))
      const known = replacing(changes.hashes?.entries[collection]?.[id])

      if (row === null)
        files.push({ path, removed: true, ...known })
      else
        files.push({ path, data: serializeEntry(collection, row, target.format), encoding: 'utf-8', ...known })
    }
  }

  for (const upload of Object.values(changes.uploads))
    files.push({ path: at(`${target.mediaDir}/${upload.name}`), data: toBase64(upload.data), encoding: 'base64' })

  for (const name of changes.removed)
    files.push({ path: at(`${target.mediaDir}/${name}`), removed: true })

  return files
}
