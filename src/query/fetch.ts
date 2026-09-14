import type { ContentReader } from './client'
import { OUTPUT_INDEX } from '../output/types'

export function fetchReader(url: string): ContentReader {
  const base = url.replace(/\/+$/, '')

  return async (path) => {
    const location = `${base}/${path}`
    const response = await fetch(location, path === OUTPUT_INDEX ? { cache: 'no-cache' } : {})

    if (response.status === 404 || (response.ok && response.headers.get('content-type')?.includes('text/html')))
      return undefined

    if (!response.ok)
      throw new Error(`[forgepress] could not load ${location}: ${response.status} ${response.statusText}`.trim())

    return response.json()
  }
}

export const reader: ContentReader = fetchReader('/content')
