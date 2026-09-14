import type { MountEditor } from './types'

import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import App from './App.vue'
import { colorModeKey, createColorMode } from './plugins/color-mode'
import { createRouter, routerKey } from './plugins/router'
import { routes } from './routes'
import styles from './styles.css?inline'

const PROPERTIES_ID = 'forgepress-properties'
const PROPERTY_RULE = /@property\s+--[\w-]+\s*\{[^}]*\}/g

function registerProperties(): (() => void) | undefined {
  if (document.getElementById(PROPERTIES_ID))
    return undefined

  const rules = styles.match(PROPERTY_RULE)

  if (!rules)
    return undefined

  const sheet = document.createElement('style')
  sheet.id = PROPERTIES_ID
  sheet.textContent = rules.join('\n')
  document.head.append(sheet)

  return () => sheet.remove()
}

function resolve(target?: Element | string | null): Element {
  const el = typeof target === 'string'
    ? document.querySelector(target)
    : typeof target === 'undefined' || target === null
      ? document.getElementById('forgepress')
      : target

  if (!el)
    throw new Error(`[forgepress] editor mount target not found: ${String(target)}`)

  return el
}

export const mountEditor: MountEditor = (target) => {
  const host = resolve(target)
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

  const sheet = document.createElement('style')
  sheet.textContent = styles

  const container = document.createElement('div')
  container.className = 'forgepress-root'
  root.replaceChildren(sheet, container)

  const unregister = registerProperties()

  const app = createApp(App, { container })
  const router = createRouter(routes)
  const colorMode = createColorMode(container)

  app.use(ui)
  app.provide(routerKey, router)
  app.provide(colorModeKey, colorMode)
  app.mount(container)

  return () => {
    app.unmount()
    router.dispose()
    colorMode.dispose()
    unregister?.()
    root.replaceChildren()
  }
}
