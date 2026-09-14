// @vitest-environment happy-dom
import type { App } from 'vue'
import type { Entries } from '../../../../src/editor/composables/useEntries'
import type { NestedEntries } from '../../../../src/editor/composables/useNestedEntries'
import type { EditorRouter } from '../../../../src/editor/plugins/router'
import type { DynamicBlock } from '../../../../src/schema/fields/dynamic'
import type { ContentRow, EntryRef } from '../../../../src/types/entry'
import type { ForgePressSchema } from '../../../../src/types/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { routerKey } from '../../../../src/editor/plugins/router'

const schema = {
  collections: {
    hero: { fields: { headline: { type: 'text' } } },
    page: { fields: { content: { type: 'dynamic', collections: ['hero', 'page'] } } },
  },
} as const satisfies ForgePressSchema

vi.doMock('../../../../src/editor/composables/useContent', () => ({
  useContent: () => ({ store: { schema: async () => schema } }),
}))

const { default: DynamicInput } = await import('../../../../src/editor/components/fields/DynamicInput.vue')
const { default: RelationInput } = await import('../../../../src/editor/components/fields/RelationInput.vue')
const { useNestedEntries } = await import('../../../../src/editor/composables/useNestedEntries')

const rows: Record<string, ContentRow> = {
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

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function mount(blocks: DynamicBlock[], trail: EntryRef[] = [{ collection: 'page', id: 'page_1' }]) {
  const container = document.createElement('div')
  const model = ref(blocks)
  let nested: NestedEntries | undefined

  app = createApp({
    render: () => h(DynamicInput, {
      'modelValue': model.value,
      'onUpdate:modelValue': (value: DynamicBlock[]) => {
        model.value = value
      },
      'collections': ['hero'],
      entries,
      'nested': nested!,
      'locales': [],
      trail,
    }),
  })

  app.provide(routerKey, { href: (path?: string) => `#/${path ?? ''}` } as unknown as EditorRouter)

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  nested = await app.runWithContext(() => useNestedEntries())
  app.mount(container)
  await settle()

  const chain = () => container.querySelector<HTMLButtonElement>('[data-icon="i-lucide-link"]')!
  const arrow = () => container.querySelector<HTMLElement>('[data-icon="i-lucide-arrow-up-right"]')!

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

describe('dynamic blocks', () => {
  it('show the linked entry as a form, with a primary chain counting its other uses', async () => {
    const { container, chain, arrow } = await mount([{ collection: 'hero', id: 'hero_1' }])

    expect(container.querySelector('input')!.value).toBe('Welcome')
    expect(chain().dataset.color).toBe('primary')
    expect(chain().textContent).toBe('2')
    expect(chain().getAttribute('title')).toBe('Linked to Welcome, also used in 2 other entries')
    expect(arrow().tagName).toBe('A')
    expect(arrow().getAttribute('href')).toBe('#/content/hero/hero_1')
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

    container.querySelector<HTMLButtonElement>('[data-icon="i-lucide-trash-2"]')!.click()
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

  it('offers new content when the linked entry is gone', async () => {
    const { container, model, nested, click } = await mount([{ collection: 'hero', id: 'hero_gone' }])

    expect(container.textContent).toContain('hero_gone does not exist anymore.')

    await click('New content')

    expect(nested.drafts[model.value[0]!.id]?.linked).toBe(false)
    expect(container.querySelector('input')).not.toBeNull()
  })
})

describe('relation fields', () => {
  it('open the related entry in a new tab', async () => {
    const container = document.createElement('div')

    app = createApp({ render: () => h(RelationInput, { modelValue: 'hero_1', collection: 'hero', entries }) })
    app.provide(routerKey, { href: (path?: string) => `#/${path ?? ''}` } as unknown as EditorRouter)

    for (const [name, component] of Object.entries(stubs))
      app.component(name, component)

    app.mount(container)

    const arrow = container.querySelector<HTMLElement>('[data-icon="i-lucide-arrow-up-right"]')!

    expect(arrow.getAttribute('href')).toBe('#/content/hero/hero_1')
    expect(arrow.getAttribute('target')).toBe('_blank')
  })
})
