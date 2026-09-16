// @vitest-environment happy-dom
import type { ColumnVisibility } from '../../../editor/composables/useColumnVisibility'
import type { FormField } from '../../../editor/utils/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useColumnVisibility } from '../../../editor/composables/useColumnVisibility'

const fields = ['title', 'slug', 'date', 'author', 'tags'].map(key => ({ key, label: key }) as FormField)
const scopes: ReturnType<typeof effectScope>[] = []

function columns(): ColumnVisibility {
  const scope = effectScope()

  scopes.push(scope)

  return scope.run(() => useColumnVisibility('post', fields, ['slug']))!
}

afterEach(() => {
  for (const scope of scopes.splice(0))
    scope.stop()

  vi.restoreAllMocks()
  localStorage.clear()
})

describe('useColumnVisibility', () => {
  it('shows the first fields until columns are chosen, then keeps the choice for the collection', async () => {
    const first = columns()

    expect(first.visibility.value).toEqual({ title: true, slug: false, date: true, author: true, tags: false })
    expect(localStorage.getItem('forgepress:columns:post')).toBeNull()

    first.items.value.find(item => item.label === 'tags')?.onUpdateChecked(true)
    await nextTick()

    expect(columns().visibility.value).toEqual({ title: true, slug: false, date: true, author: true, tags: true })
  })

  it('follows columns chosen in another editor tab', async () => {
    const shown = columns()

    localStorage.setItem('forgepress:columns:post', JSON.stringify({ title: false }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'forgepress:columns:post', newValue: JSON.stringify({ title: false }), storageArea: localStorage }))
    await nextTick()

    expect(shown.items.value.map(item => item.checked)).toEqual([false, true, true, true, true])
  })

  it('still works when the browser blocks storage', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })

    const shown = columns()

    shown.items.value.find(item => item.label === 'title')?.onUpdateChecked(false)

    expect(shown.visibility.value.title).toBe(false)
  })
})
