import { createApp } from 'vue'
import App from './App.vue'
import { createRouter, routerKey } from './router'
import styles from './styles.css?inline'

function resolve(target?: Element | string | null): Element {
  const el = typeof target === 'string'
    ? document.querySelector(target)
    : typeof target === 'undefined' || target === null
      ? document.getElementById('webenv')
      : target

  if (!el)
    throw new Error(`[webenv] editor mount target not found: ${String(target)}`)

  return el
}

export function mountEditor(target?: Element | string | null): () => void {
  const host = resolve(target)
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

  const sheet = document.createElement('style')
  sheet.textContent = styles

  const container = document.createElement('div')
  container.className = 'webenv-root'
  root.replaceChildren(sheet, container)

  const app = createApp(App)
  const router = createRouter()

  app.provide(routerKey, router)
  app.mount(container)

  return () => {
    app.unmount()
    router.dispose()
    root.replaceChildren()
  }
}
