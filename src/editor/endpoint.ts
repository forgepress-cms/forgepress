import type { ContentSource, ContentWriter } from '../store/types'
import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { toMeta } from '../entries/meta'
import { ENDPOINT } from '../files/paths'

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method,
    ...body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  })

  if (!response.ok && !(method === 'GET' && response.status === 404))
    throw new Error(`[forgepress] ${response.status} ${await response.text()}`)

  return response
}

async function send(method: string, path: string, body?: unknown): Promise<void> {
  await request(method, path, body)
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

async function list(collection: string): Promise<ContentRow[]> {
  return await (await request('GET', `/content/${segment(collection)}`)).json() as ContentRow[]
}

export const reader: ContentSource = {
  schema: async () => await (await request('GET', '/schema')).json() as ForgePressSchema,

  list,

  index: async collection => (await list(collection)).map(toMeta),

  entry: async (collection, id) => {
    const response = await request('GET', `/entry/${segment(collection)}/${segment(id)}`)

    return response.status === 404 ? undefined : await response.json() as ContentRow
  },
}

export const writer: ContentWriter = {
  writeSchema: schema => send('POST', '/schema', schema),
  writeEntry: (collection, row) => send('POST', `/entry/${segment(collection)}/${segment(row.id)}`, row),
  removeEntry: (collection, id) => send('DELETE', `/entry/${segment(collection)}/${segment(id)}`),
  writeContent: (collection, rows) => send('POST', `/content/${segment(collection)}`, rows),
  removeCollection: collection => send('DELETE', `/content/${segment(collection)}`),
}
