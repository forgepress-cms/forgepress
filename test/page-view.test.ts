// @vitest-environment happy-dom
import type { App } from 'vue'
import type { EditorRouter } from '../src/editor/plugins/router'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import PageView from '../src/editor/components/layout/PageView.vue'
import { createRouter, routerKey } from '../src/editor/plugins/router'

let visits = 0

const routes = {
  '': defineComponent({ render: () => h('p', 'Index page') }),
  'counted': defineComponent({
    setup: () => {
      visits += 1

      return () => h('p', `Visit ${visits}`)
    },
  }),
  'broken': defineComponent({
    async setup() {
      throw new Error('GitHub 401: Bad credentials')
    },
    render: () => null,
  }),
  'working': defineComponent({
    setup: () => () => h('button', {
      onClick: () => {
        throw new Error('Clicked')
      },
    }, 'Working page'),
  }),
}

let router: EditorRouter
let app: App

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function open(path: string) {
  window.location.hash = `#/${path}`
  router = createRouter(routes)

  const container = document.createElement('div')
  const errors: unknown[] = []

  app = createApp(PageView)
  app.provide(routerKey, router)
  app.component('UAlert', defineComponent({
    props: { title: String, description: String },
    setup: props => () => h('div', { role: 'alert' }, `${props.title}: ${props.description}`),
  }))
  app.config.errorHandler = error => void errors.push(error)
  app.mount(container)

  await settle()

  return { container, errors }
}

afterEach(() => {
  app.unmount()
  router.dispose()
})

describe('page view', () => {
  it('shows why a page could not be loaded', async () => {
    const { container, errors } = await open('broken')

    expect(container.textContent).toBe('This page could not be loaded: GitHub 401: Bad credentials')
    expect(errors).toEqual([])
  })

  it('clears the error when another page opens', async () => {
    const { container } = await open('broken')

    router.navigate('')
    await settle()

    expect(container.textContent).toBe('Index page')
  })

  it('opens the page again when it reloads', async () => {
    const { container } = await open('counted')

    expect(container.textContent).toBe('Visit 1')

    router.reload()
    await settle()

    expect(container.textContent).toBe('Visit 2')
  })

  it('leaves errors after loading to the app', async () => {
    const { container, errors } = await open('working')

    container.querySelector('button')!.click()
    await settle()

    expect(container.textContent).toBe('Working page')
    expect(errors).toEqual([new Error('Clicked')])
  })
})
