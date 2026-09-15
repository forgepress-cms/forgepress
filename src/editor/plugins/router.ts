import type { Component, InjectionKey, Ref } from 'vue'

import { shallowRef } from 'vue'

export type EditorRoutes = Record<string, Component>

export interface EditorRoute {
  path: string
  params: Record<string, string>
  page: Component
}

export type NavigationGuard = (resume: () => void) => boolean

export interface EditorRouter {
  route: Ref<EditorRoute>
  navigate: (path?: string) => void
  reload: () => void
  href: (path?: string) => string
  block: (guard: NavigationGuard) => () => void
  dispose: () => void
}

export const routerKey: InjectionKey<EditorRouter> = Symbol('forgepress:editor:router')

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
    throw new Error('[forgepress] the editor router needs a route for \'\'')

  const read = (): string => window.location.hash.replace(/^#\/?/, '')
  const route = shallowRef<EditorRoute>(matchRoute(routes, read()))

  const guards = new Set<NavigationGuard>()

  let bypass = false
  let reverting = false

  function go(path: string): void {
    if (read() === path)
      route.value = matchRoute(routes, path)
    else
      window.location.hash = `#/${path}`
  }

  function allowed(path: string): boolean {
    if (bypass) {
      bypass = false

      return true
    }

    const resume = (): void => {
      bypass = true
      go(path)
    }

    return ![...guards].some(guard => guard(resume))
  }

  const onChange = (): void => {
    if (reverting) {
      reverting = false

      return
    }

    const next = read()

    if (next === route.value.path)
      return

    if (!allowed(next)) {
      reverting = true
      window.location.hash = `#/${route.value.path}`

      return
    }

    route.value = matchRoute(routes, next)
  }

  window.addEventListener('hashchange', onChange)

  const settled = window.setTimeout(() => {
    const current = read()

    if (current !== route.value.path)
      route.value = matchRoute(routes, current)
  }, 0)

  return {
    route,

    navigate: (path) => {
      const next = path ?? ''

      if (next !== route.value.path && allowed(next))
        go(next)
    },

    reload: () => {
      const again = (): void => {
        route.value = matchRoute(routes, route.value.path)
      }

      if (![...guards].some(guard => guard(again)))
        again()
    },

    href: path => `#/${path ?? ''}`,

    block: (guard) => {
      guards.add(guard)

      return () => void guards.delete(guard)
    },

    dispose: () => {
      guards.clear()
      window.clearTimeout(settled)
      window.removeEventListener('hashchange', onChange)
    },
  }
}
