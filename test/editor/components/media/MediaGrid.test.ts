// @vitest-environment happy-dom
import type { App } from 'vue'
import type { MediaAsset } from '../../../../src/media/types'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import MediaGrid from '../../../../src/editor/components/media/MediaGrid.vue'

const stubs = {
  UButton: defineComponent({
    emits: ['click'],
    setup: (_, { emit }) => () => h('button', { type: 'button', onClick: () => emit('click') }),
  }),
  UCheckbox: defineComponent({
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    setup: (props, { emit }) => () => h('input', {
      type: 'checkbox',
      checked: props.modelValue,
      onClick: () => emit('update:modelValue', !props.modelValue),
    }),
  }),
}

function asset(name: string): MediaAsset {
  return { name, url: `/uploads/${name}`, type: 'image/png', size: 2048, modifiedAt: '2024-01-01T00:00:00Z' }
}

const assets = [asset('logo.png'), asset('team.png')]

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

function mount(props: { multiple?: boolean, onOpen?: (asset: MediaAsset) => void, onRemove?: (asset: MediaAsset) => void }) {
  const container = document.createElement('div')
  const selected = ref<string[]>([])

  app = createApp(defineComponent({
    setup: () => () => h(MediaGrid, {
      ...props,
      'assets': assets,
      'modelValue': selected.value,
      'onUpdate:modelValue': (value: string[]) => {
        selected.value = value
      },
    }),
  }))

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  app.mount(container)

  async function click(selector: string): Promise<void> {
    container.querySelector<HTMLElement>(selector)!.click()
    await nextTick()
  }

  return { container, selected, click }
}

describe('media grid', () => {
  it('opens an asset on click and selects assets only through their checkboxes', async () => {
    const opened: string[] = []
    const { container, selected, click } = mount({ multiple: true, onOpen: asset => opened.push(asset.name) })

    await click('[aria-label="Show team.png"]')

    expect(opened).toEqual(['team.png'])
    expect(selected.value).toEqual([])

    await click('[aria-label="Select logo.png"]')
    await click('[aria-label="Select team.png"]')

    expect(selected.value).toEqual(['logo.png', 'team.png'])
    expect(opened).toEqual(['team.png'])

    await click('[aria-label="Select logo.png"]')

    expect(selected.value).toEqual(['team.png'])
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(2)
  })

  it('deletes an asset from its trash button without opening or selecting it', async () => {
    const opened: string[] = []
    const removed: string[] = []
    const { selected, click } = mount({ multiple: true, onOpen: asset => opened.push(asset.name), onRemove: asset => removed.push(asset.name) })

    await click('[aria-label="Delete team.png"]')

    expect(removed).toEqual(['team.png'])
    expect(opened).toEqual([])
    expect(selected.value).toEqual([])
  })

  it('selects on click when assets are not opened, as in the media picker', async () => {
    const { container, selected } = mount({})
    const cards = [...container.querySelectorAll<HTMLElement>('button')]

    cards[0]!.click()
    await nextTick()

    expect(selected.value).toEqual(['logo.png'])

    cards[1]!.click()
    await nextTick()

    expect(selected.value).toEqual(['team.png'])
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0)
    expect(container.querySelectorAll('[aria-label^="Delete "]')).toHaveLength(0)
  })
})
