import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchReader } from '../../src/query/fetch'

const requests: { url: string, init: RequestInit | undefined }[] = []

function answer(status: number, body: string, type = 'application/json'): void {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    requests.push({ url, init })

    return new Response(status === 204 ? null : body, { status, statusText: status === 500 ? 'Internal Server Error' : '', headers: { 'content-type': type } })
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  requests.length = 0
})

describe('fetchReader', () => {
  it('loads files below the url and always revalidates the root index', async () => {
    answer(200, '{"version":1}')

    expect(await fetchReader('https://example.com/content/')('index.json')).toEqual({ version: 1 })
    expect(await fetchReader('/content')('author/index.1234abcd.json')).toEqual({ version: 1 })
    expect(requests).toEqual([
      { url: 'https://example.com/content/index.json', init: { cache: 'no-cache' } },
      { url: '/content/author/index.1234abcd.json', init: {} },
    ])
  })

  it('treats a 404 and an HTML fallback page as a missing file', async () => {
    answer(404, 'Not found', 'text/plain')
    expect(await fetchReader('/content')('author/index.1234abcd.json')).toBeUndefined()

    answer(200, '<!doctype html>', 'text/html; charset=utf-8')
    expect(await fetchReader('/content')('author/index.1234abcd.json')).toBeUndefined()
  })

  it('fails on other errors', async () => {
    answer(500, 'oops', 'text/plain')

    await expect(fetchReader('/content')('index.json')).rejects.toThrow('[forgepress] could not load /content/index.json: 500 Internal Server Error')
  })
})
