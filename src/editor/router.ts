import type { InjectionKey, Ref } from 'vue'

import { inject, ref } from 'vue'

export const routes = ['content', 'schema', 'assets'] as const

export type EditorRoute = typeof routes[number]

export interface EditorRouter {
  route: Ref<EditorRoute | undefined>
  navigate: (route?: EditorRoute) => void
  href: (route?: EditorRoute) => string
  dispose: () => void
}

export const routerKey: InjectionKey<EditorRouter> = Symbol('webenv:editor:router')

function parse(): EditorRoute | undefined {
  const [name] = window.location.hash.replace(/^#\/?/, '').split('/')

  return routes.includes(name as EditorRoute) ? name as EditorRoute : undefined
}

export function createRouter(): EditorRouter {
  const route = ref<EditorRoute | undefined>(parse())

  const onChange = (): void => {
    route.value = parse()
  }

  window.addEventListener('hashchange', onChange)

  return {
    route,
    navigate: name => void (window.location.hash = `#/${name ?? ''}`),
    href: name => `#/${name ?? ''}`,
    dispose: () => window.removeEventListener('hashchange', onChange),
  }
}

export function useRouter(): EditorRouter {
  return inject(routerKey)!
}
