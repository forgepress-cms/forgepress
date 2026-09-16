// @vitest-environment happy-dom
import type { App } from 'vue'
import type { MediaAsset } from '../../../../src/media/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { settle } from '../../../settle'

const measured = vi.fn()

vi.doMock('../../../../editor/utils/media', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../editor/utils/media')>(),
  measure: measured,
}))

const { default: MediaDetails } = await import('../../../../editor/components/media/MediaDetails.vue')

const stubs = {
  UModal: defineComponent({
    props: { open: Boolean, title: String, description: String },
    setup: (props, { slots }) => () => props.open ? h('div', { role: 'dialog' }, [h('h2', props.title), h('p', props.description), slots.body?.(), slots.footer?.()]) : null,
  }),
  UButton: defineComponent({
    props: { label: String, disabled: Boolean },
    emits: ['click'],
    setup: (props, { emit }) => () => h('button', { disabled: props.disabled, onClick: () => emit('click') }, props.label),
  }),
}

const photo: MediaAsset = { name: 'team.1a2b3c4d.png', url: '/uploads/team.1a2b3c4d.png', type: 'image/png', size: 1_572_864, modifiedAt: '2024-01-01T00:00:00Z' }

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
  measured.mockReset()
})

function mount(asset: MediaAsset = photo) {
  const container = document.createElement('div')
  const open = ref(true)
  const removed: string[] = []

  app = createApp(defineComponent({
    setup: () => () => h(MediaDetails, {
      'open': open.value,
      'onUpdate:open': (value: boolean) => {
        open.value = value
      },
      'asset': asset,
      'onRemove': (asset: MediaAsset) => removed.push(asset.name),
    }),
  }))

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  app.mount(container)

  const row = (label: string): string | undefined => [...container.querySelectorAll('div > span:first-child')]
    .find(element => element.textContent === label)
    ?.nextElementSibling
    ?.textContent ?? undefined
  const button = (label: string): HTMLButtonElement => [...container.querySelectorAll('button')].find(element => element.textContent === label)!

  return { container, open, removed, row, button }
}

describe('media details', () => {
  it('shows the name, dimensions and file size, and offers to delete the asset', async () => {
    measured.mockResolvedValue({ width: 1920, height: 1080 })

    const { container, removed, row, button } = mount()

    expect(row('Width')).toBe('…')

    await settle()

    expect(container.querySelector('h2')?.textContent).toBe('team.1a2b3c4d.png')
    expect(container.querySelector('p')?.textContent).toBe('image/png')
    expect(row('Name')).toBe('team.1a2b3c4d.png')
    expect(row('Width')).toBe('1920 px')
    expect(row('Height')).toBe('1080 px')
    expect(row('File size')).toBe('1.5 MB')
    expect(row('URL')).toBe('/uploads/team.1a2b3c4d.png')
    expect(measured).toHaveBeenCalledWith('/uploads/team.1a2b3c4d.png', 'image')

    button('Delete').click()

    expect(removed).toEqual(['team.1a2b3c4d.png'])
  })

  it('leaves out the file size and date the repository doesn\'t know', async () => {
    measured.mockResolvedValue({ width: 64, height: 48 })

    const { row } = mount({ name: 'team.1a2b3c4d.png', url: '/uploads/team.1a2b3c4d.png', type: 'image/png' })

    await settle()

    expect(row('Width')).toBe('64 px')
    expect(row('File size')).toBeUndefined()
    expect(row('Modified')).toBeUndefined()
  })

  it('says when the dimensions cannot be read', async () => {
    measured.mockResolvedValue(undefined)

    const { row, open, button } = mount()

    await settle()

    expect(row('Width')).toBe('Unknown')
    expect(row('Height')).toBe('Unknown')

    button('Close').click()

    expect(open.value).toBe(false)
  })
})
