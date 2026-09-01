import type { ContentWriter } from '../types/content/writer'
import { ENDPOINT } from '../content/paths'

async function request(method: string, path: string, body?: unknown): Promise<void> {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...body !== undefined && { body: JSON.stringify(body) },
  })

  if (!response.ok)
    throw new Error(`[webenv] ${response.status} ${await response.text()}`)
}

export const writer: ContentWriter = {
  writeSchema: schema => request('POST', '/schema', schema),
  writeContent: (component, rows) => request('POST', `/content/${component}`, rows),
  removeContent: component => request('DELETE', `/content/${component}`),
}
