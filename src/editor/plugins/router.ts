import type { Component, InjectionKey, Ref } from 'vue'

import { shallowRef } from 'vue'
import { updateAddress } from '../utils/address'

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
  follow: (event: MouseEvent) => void
  block: (guard: NavigationGuard) => () => void
  dispose: () => void
}

export const routerKey: InjectionKey<EditorRouter> = Symbol('forgepress:editor:router')

const PATH_PARAMETER = 'path'
const LEADING_SLASHES = /^\/+/

function pathOf(url: URL | Location): string {
  return (new URLSearchParams(url.search).get(PATH_PARAMETER) ?? '').replace(LEADING_SLASHES, '')
}

function addressOf(path: string): string {
  return path ? `${window.location.pathname}?${PATH_PARAMETER}=/${path.split('/').map(encodeURIComponent).join('/')}` : window.location.pathname
}

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

  const read = (): string => pathOf(window.location)
  const route = shallowRef<EditorRoute>(matchRoute(routes, read()))

  const guards = new Set<NavigationGuard>()

  function show(path: string): void {
    route.value = matchRoute(routes, path)
  }

  function go(path: string): void {
    show(path)

    if (read() !== path)
      updateAddress(addressOf(path), true)
  }

  function allowed(resume: () => void): boolean {
    return ![...guards].some(guard => guard(resume))
  }

  function navigate(path = ''): void {
    if (path !== route.value.path && allowed(() => go(path)))
      go(path)
  }

  const onChange = (): void => {
    const next = read()

    if (next === route.value.path)
      return

    if (allowed(() => go(next)))
      show(next)
    else
      updateAddress(addressOf(route.value.path), true)
  }

  window.addEventListener('popstate', onChange)

  const settled = window.setTimeout(() => {
    const current = read()

    if (current !== route.value.path)
      show(current)
  }, 0)

  return {
    route,

    navigate,

    reload: () => {
      const again = (): void => show(route.value.path)

      if (![...guards].some(guard => guard(again)))
        again()
    },

    href: path => addressOf(path ?? ''),

    follow: (event) => {
      const link = event.composedPath().find(node => node instanceof HTMLAnchorElement)

      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (link.target && link.target !== '_self') || link.hasAttribute('download'))
        return

      const url = new URL(link.href)

      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.hash || [...url.searchParams.keys()].some(key => key !== PATH_PARAMETER))
        return

      event.preventDefault()
      navigate(pathOf(url))
    },

    block: (guard) => {
      guards.add(guard)

      return () => void guards.delete(guard)
    },

    dispose: () => {
      guards.clear()
      window.clearTimeout(settled)
      window.removeEventListener('popstate', onChange)
    },
  }
}
