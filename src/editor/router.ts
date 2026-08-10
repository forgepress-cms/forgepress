import type { InjectionKey, Ref } from 'vue'

import { inject, ref } from 'vue'

export interface EditorRoute {
  component?: string
  id?: string
}

export interface EditorRouter {
  route: Ref<EditorRoute>
  navigate: (path: string) => void
  href: (path: string) => string
  dispose: () => void
}

export const routerKey: InjectionKey<EditorRouter> = Symbol('webenv:editor:router')

function parse(): EditorRoute {
  const [component, id] = window.location.hash.replace(/^#\/?/, '').split('/')

  return {
    ...(component ? { component } : {}),
    ...(id ? { id } : {}),
  }
}

export function createRouter(): EditorRouter {
  const route = ref<EditorRoute>(parse())

  const onChange = (): void => {
    route.value = parse()
  }

  window.addEventListener('hashchange', onChange)

  return {
    route,
    navigate: path => void (window.location.hash = `#/${path}`),
    href: path => `#/${path}`,
    dispose: () => window.removeEventListener('hashchange', onChange),
  }
}

export function useRouter(): EditorRouter {
  return inject(routerKey)!
}
