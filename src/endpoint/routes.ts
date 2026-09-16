export const ENDPOINT = '/__forgepress'
export const EVENTS = `${ENDPOINT}/events`
export const ROUTES = { schema: '/schema', content: '/content', entry: '/entry', media: '/media' } as const

export function route(base: string, ...segments: string[]): string {
  return [base, ...segments.map(encodeURIComponent)].join('/')
}
