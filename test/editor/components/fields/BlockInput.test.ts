// @vitest-environment happy-dom
import type { App } from 'vue'
import type { Entries } from '../../../../editor/composables/useEntries'
import type { NestedEntries } from '../../../../editor/composables/useNestedEntries'
import type { EditorRouter } from '../../../../editor/plugins/router'
import type { Entry, EntryRef } from '../../../../src/entries/types'
import type { ForgePressSchema } from '../../../../src/schema/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { routerKey } from '../../../../editor/plugins/router'
import { settle } from '../../../settle'

const schema = {
  collections: {
    hero: { fields: { headline: { type: 'text' } } },
    page: { fields: { content: { type: 'collection', collections: ['hero', 'page'], multiple: true } } },
  },
} as const satisfies ForgePressSchema

vi.doMock('../../../../editor/composables/useContent', () => ({
  useContent: () => ({ store: { schema: async () => schema } }),
}))

const { default: BlockInput } = await import('../../../../editor/components/fields/BlockInput.vue')
const { default: EntrySelect } = await import('../../../../editor/components/fields/EntrySelect.vue')
const { useNestedEntries } = await import('../../../../editor/composables/useNestedEntries')

const rows: Record<string, Entry> = {
  'hero/hero_1': { id: 'hero_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', headline: 'Welcome' },
  'hero/hero_2': { id: 'hero_2', status: 'unpublished', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', headline: 'Goodbye' },
  'page/page_1': { id: 'page_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', content: [] },
}

const entries: Entries = {
  options: collection => Object.entries(rows)
    .filter(([key]) => key.startsWith(`${collection}/`))
    .map(([, row]) => ({ label: String(row.headline ?? row.id), value: row.id, chip: { color: 'success' } })),
  label: (collection, id) => String(rows[`${collection}/${String(id)}`]?.headline ?? id),
  collectionLabel: collection => collection === 'hero' ? 'Hero' : 'Page',
  row: (collection, id) => rows[`${collection}/${id}`],
  usedBy: (collection, id) => collection === 'hero' && id === 'hero_1'
    ? [{ collection: 'page', id: 'page_1' }, { collection: 'page', id: 'page_2' }, { collection: 'page', id: 'page_3' }]
    : [],
}

const stubs = {
  UButton: defineComponent({
    props: { label: String, icon: String, color: String, to: String, target: String, disabled: Boolean },
    emits: ['click'],
    setup: (props, { emit }) => () => h(props.to ? 'a' : 'button', {
      'href': props.to,
      'target': props.target,
      'disabled': props.disabled || undefined,
      'data-icon': props.icon,
      'data-color': props.color,
      'onClick': () => emit('click'),
    }, props.label),
  }),
  UPopover: defineComponent({
    props: { open: Boolean },
    emits: ['update:open'],
    setup: (props, { emit, slots }) => () => h('span', [
      h('span', { 'data-trigger': '', 'onClick': () => emit('update:open', !props.open) }, slots.default?.()),
      props.open ? h('div', { role: 'dialog' }, slots.content?.()) : null,
    ]),
  }),
  UCommandPalette: defineComponent({
    props: { groups: Array },
    setup: props => () => h('div', (props.groups as { items: { label: string, active?: boolean, onSelect: () => void }[] }[])
      .flatMap(group => group.items.map(item => h('button', { 'data-active': item.active || undefined, 'onClick': () => item.onSelect() }, item.label)))),
  }),
  UFormField: defineComponent({ setup: (_, { slots }) => () => h('label', slots.default?.()) }),
  UInput: defineComponent({
    props: { modelValue: [String, Number] },
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
  }),
  UTabs: defineComponent({ setup: () => () => null }),
  UIcon: defineComponent({ setup: () => () => h('span') }),
  USelectMenu: defineComponent({ setup: () => () => null }),
  UChip: defineComponent({ setup: () => () => null }),
}

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

async function mount(blocks: EntryRef[], trail: EntryRef[] = [{ collection: 'page', id: 'page_1' }]) {
  const container = document.createElement('div')
  const model = ref(blocks)
  let nested: NestedEntries | undefined

  app = createApp({
    render: () => h(BlockInput, {
      'modelValue': model.value,
      'onUpdate:modelValue': (value: unknown) => {
        model.value = value as EntryRef[]
      },
      'collections': ['hero', 'page'],
      'multiple': true,
      entries,
      'nested': nested!,
      'locales': [],
      trail,
    }),
  })

  app.provide(routerKey, { href: (path?: string) => `/admin?path=/${path ?? ''}` } as unknown as EditorRouter)

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  nested = await app.runWithContext(() => useNestedEntries())
  app.mount(container)
  await settle()

  const chain = () => container.querySelector<HTMLButtonElement>('[data-icon="i-hugeicons-link-01"]')!
  const arrow = () => container.querySelector<HTMLElement>('[data-icon="i-hugeicons-arrow-up-right-01"]')!

  async function click(label: string): Promise<void> {
    const button = [...container.querySelectorAll('button')].find(element => element.textContent === label)

    if (!button)
      throw new Error(`no button "${label}" in: ${container.innerHTML}`)

    button.click()
    await nextTick()
    await settle()
  }

  async function openChain(): Promise<void> {
    container.querySelector<HTMLElement>('[data-trigger]')!.click()
    await nextTick()
  }

  return { container, model, nested: nested!, chain, arrow, click, openChain }
}

describe('block fields', () => {
  it('show the linked entry as a form, with a primary chain counting its other uses', async () => {
    const { container, chain, arrow } = await mount([{ collection: 'hero', id: 'hero_1' }])

    expect(container.querySelector('input')!.value).toBe('Welcome')
    expect(chain().dataset.color).toBe('primary')
    expect(chain().textContent).toBe('2')
    expect(chain().getAttribute('title')).toBe('Linked to Welcome, also used in 2 other entries')
    expect(arrow().tagName).toBe('A')
    expect(arrow().getAttribute('href')).toBe('/admin?path=/content/hero/hero_1')
    expect(arrow().getAttribute('target')).toBe('_blank')
  })

  it('start new content with a gray chain that links an existing entry instead', async () => {
    const { container, model, nested, chain, arrow, click, openChain } = await mount([])

    await click('Add a block')
    await click('Hero')

    const created = model.value[0]!.id

    expect(nested.drafts[created]?.linked).toBe(false)
    expect(container.querySelector('input')!.value).toBe('')
    expect(chain().dataset.color).toBe('neutral')
    expect(chain().textContent).toBe('')
    expect(arrow().tagName).toBe('BUTTON')
    expect(arrow().hasAttribute('disabled')).toBe(true)

    await openChain()
    await click('Goodbye')

    expect(model.value).toEqual([{ collection: 'hero', id: 'hero_2' }])
    expect(nested.drafts[created]).toBeUndefined()
    expect(chain().dataset.color).toBe('primary')
    expect(container.querySelector('input')!.value).toBe('Goodbye')
    expect(container.querySelector('[role=dialog]')).toBeNull()
  })

  it('turn a linked block into new content that keeps what was typed', async () => {
    const { container, model, nested, chain, click, openChain } = await mount([{ collection: 'hero', id: 'hero_1' }])
    const input = container.querySelector('input')!

    input.value = 'Welcome back'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    await openChain()

    expect(container.querySelector('[data-active]')?.textContent).toBe('Welcome')

    await click('Unlink and keep a copy')

    const copy = model.value[0]!.id

    expect(copy).not.toBe('hero_1')
    expect(chain().dataset.color).toBe('neutral')
    expect(container.querySelector('input')!.value).toBe('Welcome back')
    expect(nested.rows('published')).toEqual({ hero: [expect.objectContaining({ id: copy, headline: 'Welcome back' })] })
  })

  it('keeps edits to a linked entry that is removed from the field', async () => {
    const { container, model, nested } = await mount([{ collection: 'hero', id: 'hero_1' }])
    const input = container.querySelector('input')!

    input.value = 'Welcome back'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    container.querySelector<HTMLButtonElement>('[data-icon="i-hugeicons-delete-02"]')!.click()
    await nextTick()

    expect(model.value).toEqual([])
    expect(nested.rows('published')).toEqual({ hero: [expect.objectContaining({ id: 'hero_1', headline: 'Welcome back' })] })
  })

  it('does not open an entry again inside itself', async () => {
    const { container, chain, openChain } = await mount([{ collection: 'page', id: 'page_1' }])

    expect(container.textContent).toContain('page_1 is already open above')
    expect(container.querySelector('input')).toBeNull()
    expect(chain().dataset.color).toBe('primary')

    await openChain()

    expect(container.querySelector('[role=dialog]')!.textContent).toBe('')
  })

  it('stop opening entries below three levels, and link instead of creating there', async () => {
    const trail = [
      { collection: 'page', id: 'page_1' },
      { collection: 'hero', id: 'deep_1' },
      { collection: 'hero', id: 'deep_2' },
    ]

    const within = await mount([{ collection: 'hero', id: 'hero_1' }], trail)

    expect(within.container.querySelector('input')!.value).toBe('Welcome')

    const { container, model, nested, click } = await mount([{ collection: 'hero', id: 'hero_1' }], [...trail, { collection: 'hero', id: 'deep_3' }])

    expect(container.textContent).toContain('Welcome is nested too deeply to edit here')
    expect(container.querySelector('input')).toBeNull()
    expect(nested.drafts.hero_1).toBeUndefined()

    await click('Add a block')
    await click('Hero')

    expect(model.value[1]).toEqual({ collection: 'hero', id: '' })
    expect(Object.keys(nested.drafts)).toEqual([])
    expect(container.textContent).toContain('No entry is linked yet. Link one with the chain icon.')
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'New content')).toBe(false)
  })

  it('offers new content when the linked entry is gone', async () => {
    const { container, model, nested, click } = await mount([{ collection: 'hero', id: 'hero_gone' }])

    expect(container.textContent).toContain('hero_gone does not exist anymore.')

    await click('New content')

    expect(nested.drafts[model.value[0]!.id]?.linked).toBe(false)
    expect(container.querySelector('input')).not.toBeNull()
  })
})

describe('entry fields', () => {
  it('open the related entry in a new tab', async () => {
    const container = document.createElement('div')

    app = createApp({ render: () => h(EntrySelect, { modelValue: 'hero_1', collection: 'hero', entries }) })
    app.provide(routerKey, { href: (path?: string) => `/admin?path=/${path ?? ''}` } as unknown as EditorRouter)

    for (const [name, component] of Object.entries(stubs))
      app.component(name, component)

    app.mount(container)

    const arrow = container.querySelector<HTMLElement>('[data-icon="i-hugeicons-arrow-up-right-01"]')!

    expect(arrow.getAttribute('href')).toBe('/admin?path=/content/hero/hero_1')
    expect(arrow.getAttribute('target')).toBe('_blank')
  })
})
