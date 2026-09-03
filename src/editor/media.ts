import type { MediaAsset, MediaClient } from '../types/content/media'
import { ENDPOINT } from '../content/paths'

export type { MediaClient }

async function request(method: string, path: string, file?: File): Promise<unknown> {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method,
    ...file && { headers: { 'content-type': file.type || 'application/octet-stream' }, body: file },
  })

  if (!response.ok)
    throw new Error(`[webenv] ${response.status} ${await response.text()}`)

  return response.status === 204 ? undefined : response.json()
}

export const media: MediaClient = {
  list: async () => await request('GET', '/media') as MediaAsset[],
  upload: async file => await request('POST', `/media/${encodeURIComponent(file.name)}`, file) as MediaAsset,
  remove: async (name) => {
    await request('DELETE', `/media/${encodeURIComponent(name)}`)
  },
}
