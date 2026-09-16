import type { Entry } from '../entries/types'
import type { MediaAsset, MediaClient } from '../media/types'
import type { ForgePressSchema } from '../schema/types'
import type { ContentSource, ContentWriter, SchemaWriter } from '../store/types'
import { ENDPOINT, route, ROUTES } from './routes'

export interface Endpoint {
  reader: ContentSource
  writer: ContentWriter & SchemaWriter
  media: MediaClient
}

function json(body: unknown): RequestInit {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

export function createEndpoint(server: string): Endpoint {
  async function request(method: string, path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${server}${ENDPOINT}${path}`, { method, ...init })

    if (!response.ok && !(method === 'GET' && response.status === 404))
      throw new Error(`[forgepress] ${response.status} ${await response.text()}`)

    return response
  }

  async function send(method: string, path: string, init?: RequestInit): Promise<void> {
    await request(method, path, init)
  }

  return {
    reader: {
      schema: async () => await (await request('GET', ROUTES.schema)).json() as ForgePressSchema,

      list: async collection => await (await request('GET', route(ROUTES.content, collection))).json() as Entry[],

      entry: async (collection, id) => {
        const response = await request('GET', route(ROUTES.entry, collection, id))

        return response.status === 404 ? undefined : await response.json() as Entry
      },
    },

    writer: {
      writeSchema: schema => send('POST', ROUTES.schema, json(schema)),
      writeEntry: (collection, row) => send('POST', route(ROUTES.entry, collection, row.id), json(row)),
      removeEntry: (collection, id) => send('DELETE', route(ROUTES.entry, collection, id)),
      writeContent: (collection, rows) => send('POST', route(ROUTES.content, collection), json(rows)),
      removeCollection: collection => send('DELETE', route(ROUTES.content, collection)),
    },

    media: {
      list: async () => await (await request('GET', ROUTES.media)).json() as MediaAsset[],

      upload: async file => await (await request('POST', route(ROUTES.media, file.name), {
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      })).json() as MediaAsset,

      remove: name => send('DELETE', route(ROUTES.media, name)),
    },
  }
}
