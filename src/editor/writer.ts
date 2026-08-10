import type { ContentWriter } from '../types/content/writer'
import { ENDPOINT } from '../content/paths'

async function post(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok)
    throw new Error(`[webenv] ${response.status} ${await response.text()}`)
}

/** Hands saves to the node writer running in the dev server. */
export const writer: ContentWriter = {
  writeSchema: schema => post('/schema', schema),
  writeContent: (component, rows) => post(`/content/${component}`, rows),
}
