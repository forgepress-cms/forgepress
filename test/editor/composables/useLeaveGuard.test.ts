// @vitest-environment happy-dom
import type { App } from 'vue'
import type { EditorRouter } from '../../../editor/plugins/router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive } from 'vue'
import { useDraft } from '../../../editor/composables/useDraft'
import { useLeaveGuard } from '../../../editor/composables/useLeaveGuard'
import { createRouter, routerKey } from '../../../editor/plugins/router'
import { settle } from '../../settle'

const routes = { '': { name: 'index' }, 'content': { name: 'content' }, 'schema': { name: 'schema' } }

let router: EditorRouter
let app: App

async function follow(path: string): Promise<void> {
  const link = document.createElement('a')

  link.href = router.href(path)
  link.addEventListener('click', router.follow)
  document.body.append(link)
  link.click()
  link.remove()
  await settle()
}

function edit() {
  const form = reactive({ label: 'Name' })
  const back: string[] = []

  const collection = defineComponent({
    setup: () => ({ draft: useLeaveGuard(useDraft(() => form, () => back.push('back'))) }),
    render: () => h('div'),
  })

  app = createApp(collection)
  app.provide(routerKey, router)

  const { draft } = app.mount(document.createElement('div')) as unknown as { draft: ReturnType<typeof useDraft> }

  return { form, back, draft }
}

beforeEach(() => {
  window.history.replaceState(null, '', '/admin')
  router = createRouter(routes)
})

afterEach(() => {
  app?.unmount()
  router.dispose()
})

describe('useLeaveGuard', () => {
  it('lets a clean draft leave', async () => {
    const { draft } = edit()

    await follow('schema')

    expect(draft.leaving.value).toBe(false)
    expect(router.route.value.path).toBe('schema')
  })

  it('asks before following a link away from a dirty draft', async () => {
    const { form, draft } = edit()

    form.label = 'Title'

    await follow('schema')

    expect(draft.leaving.value).toBe(true)
    expect(router.route.value.path).toBe('')
  })

  it('follows the held link after discarding', async () => {
    const { form, back, draft } = edit()

    form.label = 'Title'

    await follow('schema')

    draft.discard()
    await settle()

    expect(router.route.value.path).toBe('schema')
    expect(back).toEqual([])
  })

  it('falls back to the page itself when the dialog was not opened by a link', async () => {
    const { form, back, draft } = edit()

    form.label = 'Title'

    draft.cancel()

    expect(draft.leaving.value).toBe(true)

    draft.discard()

    expect(back).toEqual(['back'])
  })

  it('forgets a held link once the dialog is dismissed', async () => {
    const { form, back, draft } = edit()

    form.label = 'Title'

    await follow('schema')

    draft.leaving.value = false
    await nextTick()

    draft.cancel()
    draft.discard()
    await settle()

    expect(back).toEqual(['back'])
    expect(router.route.value.path).toBe('')
  })

  it('continues to the held link after saving', async () => {
    const { form, back, draft } = edit()

    form.label = 'Title'

    await follow('schema')

    expect(draft.leaving.value).toBe(true)

    draft.commit()
    draft.proceed()
    await settle()

    expect(router.route.value.path).toBe('schema')
    expect(back).toEqual([])
  })

  it('returns to the page itself when saving without a held link', async () => {
    const { form, back, draft } = edit()

    form.label = 'Title'

    draft.cancel()
    draft.commit()
    draft.proceed()
    await settle()

    expect(back).toEqual(['back'])
    expect(draft.leaving.value).toBe(false)
  })

  it('stops guarding once the page is gone', async () => {
    const { form } = edit()

    form.label = 'Title'

    app.unmount()

    await follow('schema')

    expect(router.route.value.path).toBe('schema')
  })
})
