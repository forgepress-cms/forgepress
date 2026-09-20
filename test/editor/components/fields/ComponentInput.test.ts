// @vitest-environment happy-dom
import type { App } from 'vue'
import type { Entries } from '../../../../editor/composables/useEntries'
import type { NestedEntries } from '../../../../editor/composables/useNestedEntries'
import type { EditorRouter } from '../../../../editor/plugins/router'
import type { ForgePressSchema } from '../../../../src/schema/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { routerKey } from '../../../../editor/plugins/router'
import { toFields } from '../../../../editor/utils/schema'
import { settle } from '../../../settle'

const schema = {
  components: {
    card: { label: 'Card', fields: { title: { type: 'text' }, wide: { type: 'boolean', default: true } } },
  },
  collections: {
    page: { fields: { cards: { type: 'component', components: ['card'], multiple: true } } },
  },
} as const satisfies ForgePressSchema

vi.doMock('../../../../editor/composables/useContent', () => ({
  useContent: () => ({ store: { schema: async () => schema } }),
}))

const { default: ComponentInput } = await import('../../../../editor/components/fields/ComponentInput.vue')

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

  app = createApp({
    render: () => h(ComponentInput, {
      'modelValue': model.value,
      'onUpdate:modelValue': (value: unknown) => {
        model.value = value
      },
      'forms': cards!.components!,
      'label': 'Cards',
      'multiple': true,
      'tagged': false,
      'entries': {} as Entries,
      'nested': {} as NestedEntries,
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
