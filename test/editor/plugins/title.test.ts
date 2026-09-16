// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createTitle } from '../../../editor/plugins/title'

afterEach(() => {
  document.title = ''
})

describe('editor title', () => {
  it('names the editor while it is mounted, and gives the page its own title back afterwards', async () => {
    document.title = 'Admin'

    const title = createTitle()

    await nextTick()
    expect(document.title).toBe('ForgePress')

    title.show('Content')
    await nextTick()
    expect(document.title).toBe('Content · ForgePress')

    title.dispose()
    expect(document.title).toBe('Admin')
  })

  it('follows a heading that changes, like an entry title while it is typed', async () => {
    const title = createTitle()
    const heading = ref('Jane')

    title.show(() => heading.value)
    heading.value = 'Jane Doe'
    await nextTick()

    expect(document.title).toBe('Jane Doe · ForgePress')
    title.dispose()
  })

  it('keeps the newest heading when the page it replaces goes away afterwards', async () => {
    const title = createTitle()
    const leaving = title.show('Content')

    const hide = title.show('Blog Post')
    leaving()
    await nextTick()
    expect(document.title).toBe('Blog Post · ForgePress')

    hide()
    await nextTick()
    expect(document.title).toBe('ForgePress')
    title.dispose()
  })
})
