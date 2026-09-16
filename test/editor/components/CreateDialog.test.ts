// @vitest-environment happy-dom
import type { App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import CreateDialog from '../../../editor/components/CreateDialog.vue'

const stubs = {
  UModal: defineComponent({
    props: { open: Boolean },
    setup: (props, { slots }) => () => props.open ? h('div', { role: 'dialog' }, [slots.body?.(), slots.footer?.()]) : null,
  }),
  UFormField: defineComponent({
    props: { label: String },
    setup: (props, { slots }) => () => h('label', { 'data-label': props.label }, slots.default?.()),
  }),
  UInput: defineComponent({
    props: { modelValue: String },
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
  }),
  UButton: defineComponent({
    props: { label: String, disabled: Boolean },
    emits: ['click'],
    setup: (props, { emit }) => () => h('button', { disabled: props.disabled, onClick: () => emit('click') }, props.label),
  }),
}

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

function mount() {
  const container = document.createElement('div')
  const open = ref(true)
  const created: [string, string][] = []

  app = createApp(defineComponent({
    setup: () => () => h(CreateDialog, {
      'open': open.value,
      'onUpdate:open': (value: boolean) => {
        open.value = value
      },
      'title': 'New collection',
      'description': 'Collections describe one kind of content entry.',
      'keyDescription': 'How the collection is referenced in queries and content files.',
      'loading': false,
      'validate': (key: string) => key === 'author' ? `${key} already exists` : key ? '' : 'A key is required',
      'onCreate': (label: string, key: string) => created.push([label, key]),
    }),
  }))

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  app.mount(container)

  const input = (label: string): HTMLInputElement => container.querySelector<HTMLInputElement>(`[data-label="${label}"] input`)!
  const button = (label: string): HTMLButtonElement => [...container.querySelectorAll('button')].find(element => element.textContent === label)!

  async function type(label: string, value: string): Promise<void> {
    const element = input(label)

    element.value = value
    element.dispatchEvent(new Event('input'))
    await nextTick()
  }

  return { container, open, created, input, button, type }
}

describe('create dialog', () => {
  it('derives the key from the name until the key is edited', async () => {
    const { input, type } = mount()

    await type('Name', 'Blog post')

    expect(input('Key').value).toBe('blogPost')

    await type('Key', 'posts')
    await type('Name', 'Blog posts')

    expect(input('Key').value).toBe('posts')
  })

  it('explains an invalid key and creates only a valid one', async () => {
    const { container, created, button, type } = mount()

    await type('Name', 'Author')

    expect(container.textContent).toContain('author already exists')
    expect(button('Create').disabled).toBe(true)

    await type('Key', 'writer')
    button('Create').click()

    expect(created).toEqual([['Author', 'writer']])
  })

  it('starts empty every time it opens', async () => {
    const { open, input, type } = mount()

    await type('Name', 'Author')

    open.value = false
    await nextTick()
    open.value = true
    await nextTick()

    expect(input('Name').value).toBe('')
    expect(input('Key').value).toBe('')
  })
})
