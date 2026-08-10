import type { Component, InjectionKey, Ref } from 'vue'

import { inject, shallowRef } from 'vue'

export type EditorRoutes = Record<string, Component>

export interface EditorRoute {
  path: string
  params: Record<string, string>
  page: Component
}

export interface EditorRouter {
  route: Ref<EditorRoute>
  navigate: (path?: string) => void
  href: (path?: string) => string
  dispose: () => void
}

export const routerKey: InjectionKey<EditorRouter> = Symbol('webenv:editor:router')

function segments(path: string): string[] {
  return path.split('/').filter(Boolean).map(decodeURIComponent)
}

function capture(pattern: string, path: string[]): Record<string, string> | undefined {
  const parts = segments(pattern)

  if (parts.length !== path.length)
    return undefined

  const params: Record<string, string> = {}

  for (const [index, part] of parts.entries()) {
    const value = path[index]!

    if (part.startsWith(':'))
      params[part.slice(1)] = value
    else if (part !== value)
      return undefined
  }

  return params
}

export function matchRoute(routes: EditorRoutes, path: string): EditorRoute {
  const parts = segments(path)

  for (const [pattern, page] of Object.entries(routes)) {
    const params = capture(pattern, parts)

    if (params)
      return { path, params, page }
  }

  return { path, params: {}, page: routes['']! }
}

export function createRouter(routes: EditorRoutes): EditorRouter {
  if (!routes[''])
    throw new Error('[webenv] the editor router needs a route for \'\'')

  const read = (): string => window.location.hash.replace(/^#\/?/, '')
  const route = shallowRef<EditorRoute>(matchRoute(routes, read()))

  const onChange = (): void => {
    route.value = matchRoute(routes, read())
  }

  window.addEventListener('hashchange', onChange)

  return {
    route,
    navigate: path => void (window.location.hash = `#/${path ?? ''}`),
    href: path => `#/${path ?? ''}`,
    dispose: () => window.removeEventListener('hashchange', onChange),
  }
}

export function useRouter(): EditorRouter {
  return inject(routerKey)!
}
