// @vitest-environment happy-dom
import type { App } from 'vue'
import type { Schema } from '../../../src/schema/types'
import type { Entries, NestedEntries } from '../../composables'
import type { EditorRouter } from '../../plugins/router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { settle } from '../../../test/settle'
import { routerKey } from '../../plugins/router'
import { toFields } from '../../utils/schema'

const schema = {
  components: {
    card: { label: 'Card', fields: { title: { type: 'text' }, wide: { type: 'boolean', default: true } } },
  },
  collections: {
    page: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
  },
} as const satisfies Schema

vi.doMock('../../composables/content/useContent', () => ({
  useContent: () => ({ store: { schema: async () => schema } }),
}))

const { default: ComponentInput } = await import('./ComponentInput.vue')

const [cards] = toFields(schema.collections.page, [], schema.components)

const stubs = {
  UButton: defineComponent({
    props: { label: String, ariaLabel: String },
    emits: ['click'],
    setup: (props, { emit }) => () => h('button', { 'aria-label': props.ariaLabel, 'onClick': () => emit('click') }, props.label),
  }),
  UFormField: defineComponent({ setup: (_, { slots }) => () => h('label', slots.default?.()) }),
  UInput: defineComponent({
    props: { modelValue: [String, Number] },
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
  }),
  USwitch: defineComponent({
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', { 'type': 'checkbox', 'checked': props.modelValue, 'data-switch': '', 'onChange': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked) }),
  }),
  UTabs: defineComponent({ setup: () => () => null }),
  UIcon: defineComponent({ setup: () => () => h('span') }),
}

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

async function mount(items: unknown) {
  const container = document.createElement('div')
  const model = ref(items)

  const entries = {} as Entries
  const nested = {} as NestedEntries

  app = createApp({
    render: () => h(ComponentInput, {
      'modelValue': model.value,
      'onUpdate:modelValue': (value: unknown) => {
        model.value = value
      },
      'forms': cards!.components!,
      'multiple': true,
      'tagged': false,
      'entries': entries,
      'nested': nested,
      'locales': [],
      'trail': [],
    }),
  })

  app.provide(routerKey, { href: (path?: string) => `/admin?path=/${path ?? ''}` } as unknown as EditorRouter)

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  app.mount(container)
  await settle()

  async function click(label: string): Promise<void> {
    const button = [...container.querySelectorAll('button')].find(element => element.textContent === label || element.getAttribute('aria-label') === label)

    if (!button)
      throw new Error(`no button "${label}" in: ${container.innerHTML}`)

    button.click()
    await nextTick()
    await settle()
  }

  async function type(index: number, text: string): Promise<void> {
    const input = container.querySelectorAll<HTMLInputElement>('input:not([data-switch])')[index]!

    input.value = text
    input.dispatchEvent(new Event('input'))
    await nextTick()
    await settle()
  }

  return { container, model, click, type }
}

describe('component items', () => {
  it('show every item as a form titled by its first text field', async () => {
    const { container } = await mount([{ title: 'One', wide: false }, { title: 'Two', wide: true }])

    expect([...container.querySelectorAll<HTMLInputElement>('input:not([data-switch])')].map(input => input.value)).toEqual(['One', 'Two'])
    expect(container.textContent).toContain('One')
    expect(container.textContent).toContain('Two')
  })

  it('title an item that has no text yet by the component it holds', async () => {
    const { container } = await mount([{ wide: false }])

    expect(container.querySelector('.flex-1')?.textContent?.trim()).toBe('Card')
  })

  it('write edits back as plain items', async () => {
    const { model, type } = await mount([{ title: 'One', wide: false }])

    await type(0, 'First')

    expect(model.value).toEqual([{ title: 'First', wide: false }])
  })

  it('add items with their defaults and remove them', async () => {
    const { model, click } = await mount([{ title: 'One', wide: false }])

    await click('Add a card')

    expect(model.value).toEqual([{ title: 'One', wide: false }, { wide: true }])

    await click('Remove One')

    expect(model.value).toEqual([{ wide: true }])
  })
})
