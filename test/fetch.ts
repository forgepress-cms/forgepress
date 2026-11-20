import { vi } from 'vitest'

interface SentRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

export function serve(routes: Record<string, unknown>): SentRequest[] {
  const requests: SentRequest[] = []

  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const method = init.method ?? 'GET'
    const path = `${url.pathname}${url.search}`
    const route = routes[method === 'GET' ? path : `${method} ${path}`]

    requests.push({ method, url: path, headers: init.headers as Record<string, string>, ...typeof init.body === 'string' ? { body: JSON.parse(init.body) } : {} })

    if (route === undefined)
      return new Response('Not Found', { status: 404 })

    if (typeof route === 'function')
      return (route as () => Response)()

    if (typeof route === 'number')
      return new Response('{"message":"Resource not accessible by personal access token"}', { status: route })

    return typeof route === 'string' ? new Response(route) : Response.json(route)
  })

  return requests
}

export function sent(requests: readonly SentRequest[], method: string, url: string): unknown {
  return requests.find(request => request.method === method && request.url === url)?.body
}
