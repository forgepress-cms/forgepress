// @vitest-environment happy-dom
import type { Root } from 'react-dom/client'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let previewing = false
const listeners = new Set<() => void>()

vi.doMock('../../src/preview/index', () => ({
  enablePreview: () => previewing,
  onPreviewChange: (listener: () => void) => {
    listeners.add(listener)

    return () => listeners.delete(listener)
  },
}))

const { usePreviewData } = await import('../../src/preview/react')

interface Shown {
  titles: string[]
}

let root: Root
let host: HTMLElement

function Page({ data, load }: { data: Shown, load: () => Promise<Shown> }) {
  return createElement('p', null, usePreviewData(data, load).titles.join(', '))
}

async function render(data: Shown, load: () => Promise<Shown>): Promise<void> {
  await act(async () => {
    root.render(createElement(Page, { data, load }))
  })
}

async function change(): Promise<void> {
  await act(async () => {
    for (const listener of [...listeners])
      listener()
  })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  previewing = false
  listeners.clear()
  host = document.createElement('div')
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
})

describe('usePreviewData', () => {
  it('shows what the page was built with to visitors, without loading anything', async () => {
    const load = vi.fn(async () => ({ titles: ['Draft'] }))

    await render({ titles: ['Published'] }, load)

    expect(host.textContent).toBe('Published')
    expect(load).not.toHaveBeenCalled()
  })

  it('loads the preview for editors, again whenever it changes, and goes back when it is turned off', async () => {
    let titles = ['Draft']
    previewing = true

    await render({ titles: ['Published'] }, async () => ({ titles }))
    expect(host.textContent).toBe('Draft')

    titles = ['Draft', 'Second draft']
    await change()
    expect(host.textContent).toBe('Draft, Second draft')

    previewing = false
    await change()
    expect(host.textContent).toBe('Published')
  })

  it('shows new page data as soon as it arrives, and only the preview that was asked for last', async () => {
    const pending: ((shown: Shown) => void)[] = []
    previewing = true

    await render({ titles: ['First page'] }, () => new Promise(resolve => pending.push(resolve)))
    await change()
    await act(async () => pending[1]?.({ titles: ['Newer preview'] }))
    await act(async () => pending[0]?.({ titles: ['Older preview'] }))

    expect(host.textContent).toBe('Newer preview')

    await render({ titles: ['Second page'] }, () => new Promise(resolve => pending.push(resolve)))
    expect(host.textContent).toBe('Second page')
  })

  it('stops listening once the component is gone', async () => {
    previewing = true

    await render({ titles: ['Published'] }, async () => ({ titles: ['Draft'] }))
    expect(listeners.size).toBe(1)

    await act(async () => root.unmount())
    expect(listeners.size).toBe(0)

    root = createRoot(host)
  })
})
