import type { ContentWriter } from '../store/types'
import { ENDPOINT } from '../files/paths'

async function request(method: string, path: string, body?: unknown): Promise<void> {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...body !== undefined && { body: JSON.stringify(body) },
  })

  if (!response.ok)
    throw new Error(`[forgepress] ${response.status} ${await response.text()}`)
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

export const writer: ContentWriter = {
  writeSchema: schema => request('POST', '/schema', schema),
  writeEntry: (collection, row) => request('POST', `/entry/${segment(collection)}/${segment(row.id)}`, row),
  removeEntry: (collection, id) => request('DELETE', `/entry/${segment(collection)}/${segment(id)}`),
  writeContent: (collection, rows) => request('POST', `/content/${segment(collection)}`, rows),
  removeCollection: collection => request('DELETE', `/content/${segment(collection)}`),
}
