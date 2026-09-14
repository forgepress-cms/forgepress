// @vitest-environment happy-dom
import type { App } from 'vue'
import type { Resolution } from '../../../src/changes/types'
import type { Conflict } from '../../../src/forge/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref, shallowRef } from 'vue'
import { routerKey } from '../../../src/editor/plugins/router'

const conflicts = shallowRef<readonly Conflict[]>([])
const calls: string[] = []
const outcomes: (() => string | undefined)[] = []
const reload = vi.fn()

vi.doMock('../../../src/editor/composables/usePublish', () => ({
  usePublish: () => ({
    summary: ref({}),
    diff: ref([]),
    count: ref(1),
    publishing: ref(false),
    error: ref(''),
    conflicts,
    refresh: async () => {},
    publish: async () => {
      calls.push('publish')

      return outcomes.shift()?.()
    },
    resolve: async (keep: Resolution) => {
      calls.push(`resolve ${keep}`)
      conflicts.value = []

      return true
    },
  }),
}))

vi.doMock('../../../src/editor/composables/useSession', () => ({
  useSession: () => ({ branch: ref('main') }),
}))

const { default: PublishDialog } = await import('../../../src/editor/components/PublishDialog.vue')

const stubs = {
  UModal: defineComponent({
    props: { open: Boolean },
    setup: (props, { slots }) => () => props.open ? h('div', { role: 'dialog' }, [slots.body?.(), slots.footer?.()]) : null,
  }),
  UAlert: defineComponent({
    props: { title: String, description: String, actions: Array },
    setup: (props, { slots }) => () => h('div', { role: 'alert' }, [
      props.title,
      slots.description?.() ?? props.description,
      ...(props.actions as { label: string, onClick: () => void }[] | undefined ?? []).map(action => h('button', { onClick: action.onClick }, action.label)),
    ]),
  }),
  UButton: defineComponent({
    props: { label: String, disabled: Boolean },
    emits: ['click'],
    setup: (props, { emit }) => () => h('button', { disabled: props.disabled, onClick: () => emit('click') }, props.label),
  }),
  UFormField: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  UInput: defineComponent({ setup: () => () => h('input') }),
  UIcon: defineComponent({ setup: () => () => h('span') }),
}

let app: App
let container: HTMLElement

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(element => element.textContent === label)

  if (!button)
    throw new Error(`no button "${label}" in: ${container.textContent}`)

  button.click()
  await settle()
}

function conflicted(): undefined {
  conflicts.value = [{ path: '.forgepress/content/author/a.ts', hash: 'h-theirs' }]

  return undefined
}

beforeEach(async () => {
  conflicts.value = []
  calls.length = 0
  outcomes.length = 0
  reload.mockClear()

  const open = ref(true)

  container = document.createElement('div')
  app = createApp(defineComponent({
    setup: () => () => h(PublishDialog, { 'open': open.value, 'onUpdate:open': (value: boolean) => open.value = value }),
  }))

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  app.provide(routerKey, { reload } as never)
  app.mount(container)

  await settle()
})

afterEach(() => {
  app.unmount()
})

describe('publish dialog', () => {
  it('names the files that changed in the repository', async () => {
    outcomes.push(conflicted)

    await click('Publish')

    expect(container.textContent).toContain('Changed in the repository since your edit')
    expect(container.textContent).toContain('.forgepress/content/author/a.ts')
  })

  it('drops my edits to them and reloads the page once closed', async () => {
    outcomes.push(conflicted)

    await click('Publish')
    await click('Drop my edits')

    expect(calls).toEqual(['publish', 'resolve theirs'])
    expect(container.textContent).not.toContain('Changed in the repository')
    expect(reload).not.toHaveBeenCalled()

    await click('Close')

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('publishes mine anyway', async () => {
    outcomes.push(conflicted, () => 'c2abcdef')

    await click('Publish')
    await click('Publish mine anyway')

    expect(calls).toEqual(['publish', 'resolve mine', 'publish'])
    expect(container.textContent).toContain('Published as c2abcde')

    await click('Close')

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the page alone when publishing changed nothing', async () => {
    outcomes.push(() => undefined)

    await click('Publish')
    await click('Close')

    expect(reload).not.toHaveBeenCalled()
  })
})
