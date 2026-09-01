import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { useDraft } from '../src/editor/composables/useDraft'

describe('useDraft', () => {
  it('leaves straight away while nothing changed', () => {
    const form = reactive({ label: 'Name' })
    let left = false

    const draft = useDraft(() => form, () => (left = true))

    draft.cancel()

    expect(left).toBe(true)
    expect(draft.leaving.value).toBe(false)
  })

  it('asks first once something changed', () => {
    const form = reactive({ label: 'Name' })
    let left = false

    const draft = useDraft(() => form, () => (left = true))

    form.label = 'Title'

    expect(draft.dirty.value).toBe(true)

    draft.cancel()

    expect(left).toBe(false)
    expect(draft.leaving.value).toBe(true)

    draft.discard()

    expect(left).toBe(true)
  })

  it('is clean again after a commit', () => {
    const form = reactive({ label: 'Name' })
    const draft = useDraft(() => form, () => {})

    form.label = 'Title'
    draft.commit()

    expect(draft.dirty.value).toBe(false)
  })
})
