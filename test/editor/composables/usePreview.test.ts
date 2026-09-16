// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { usePreview } from '../../../editor/composables/usePreview'
import { setPreviewEnabled } from '../../../src/preview/state'

describe('preview switch', () => {
  it('is on by default and follows the badge turning it off', () => {
    const preview = usePreview()

    expect(preview.enabled.value).toBe(true)

    preview.set(false)

    expect(preview.enabled.value).toBe(false)
    expect(localStorage.getItem('forgepress:preview:off')).toBe('1')

    setPreviewEnabled(true)

    expect(usePreview().enabled.value).toBe(true)
  })
})
