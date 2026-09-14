import type { MediaAsset, MediaClient } from '../media/types'
import type { ContentSource, ContentWriter, SchemaWriter } from '../store/types'
import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { ENDPOINT } from '../files/paths'

async function request(method: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${ENDPOINT}${path}`, { method, ...init })

  if (!response.ok && !(method === 'GET' && response.status === 404))
    throw new Error(`[forgepress] ${response.status} ${await response.text()}`)

  return response
}

function json(body: unknown): RequestInit {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

async function send(method: string, path: string, init?: RequestInit): Promise<void> {
  await request(method, path, init)
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

export const reader: ContentSource = {
  schema: async () => await (await request('GET', '/schema')).json() as ForgePressSchema,

  list: async collection => await (await request('GET', `/content/${segment(collection)}`)).json() as ContentRow[],

  entry: async (collection, id) => {
    const response = await request('GET', `/entry/${segment(collection)}/${segment(id)}`)

    return response.status === 404 ? undefined : await response.json() as ContentRow
  },
}

export const writer: ContentWriter & SchemaWriter = {
  writeSchema: schema => send('POST', '/schema', json(schema)),
  writeEntry: (collection, row) => send('POST', `/entry/${segment(collection)}/${segment(row.id)}`, json(row)),
  removeEntry: (collection, id) => send('DELETE', `/entry/${segment(collection)}/${segment(id)}`),
  writeContent: (collection, rows) => send('POST', `/content/${segment(collection)}`, json(rows)),
  removeCollection: collection => send('DELETE', `/content/${segment(collection)}`),
}

export const media: MediaClient = {
  list: async () => await (await request('GET', '/media')).json() as MediaAsset[],

  upload: async file => await (await request('POST', `/media/${segment(file.name)}`, {
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })).json() as MediaAsset,

  remove: name => send('DELETE', `/media/${segment(name)}`),
}
