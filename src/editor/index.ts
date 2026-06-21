import { createApp } from 'vue'
import App from './App.vue'
import { createRouter, routerKey } from './router'

export function mountEditor(target?: Element | string | null): () => void {
  const el = typeof target === 'string'
    ? document.querySelector(target)
    : typeof target === 'undefined' || target === null
      ? document.getElementById('webenv')
      : target

  if (!el)
    throw new Error(`[webenv] editor mount target not found: ${String(target)}`)

  const app = createApp(App)
  const router = createRouter()

  app.provide(routerKey, router)
  app.mount(el)

  return () => {
    app.unmount()
    router.dispose()
  }
}
