// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBadge } from '../../src/preview/badge'

function parts() {
  const host = document.querySelector('forgepress-preview')
  const badge = host?.shadowRoot?.querySelector<HTMLElement>('.badge')

  return { host, badge, button: badge?.querySelector<HTMLElement>('button:not(.close)'), close: badge?.querySelector<HTMLElement>('.close'), label: badge?.querySelector('span:not(.dot)')?.textContent }
}

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
})

describe('preview badge', () => {
  it('says whether the preview is loading, ready or unavailable', () => {
    const badge = createBadge(() => {})

    badge.show({ status: 'loading' })
    expect(parts().label).toBe('Loading preview…')

    badge.show({ status: 'ready' })
    expect(parts().label).toBe('Preview: on')
    expect(parts().badge?.title).toBe('')

    badge.show({ status: 'off' })
    expect(parts().label).toBe('Preview: off')
    expect(parts().button?.textContent).toBe('Turn on')

    badge.show({ status: 'failed', error: '[forgepress] Forgejo 401: token is expired' })
    expect(parts().label).toBe('Preview unavailable')
    expect(parts().badge?.dataset.status).toBe('failed')
    expect(parts().badge?.title).toBe('[forgepress] Forgejo 401: token is expired. The site shows published content.')
    expect(document.querySelectorAll('forgepress-preview')).toHaveLength(1)
  })

  it('turns the preview off and on from its button and goes away when hidden', () => {
    const setEnabled = vi.fn()
    const badge = createBadge(setEnabled)

    badge.show({ status: 'ready' })
    parts().button?.click()

    expect(setEnabled).toHaveBeenLastCalledWith(false)
    expect(parts().button?.textContent).toBe('Turn off')
    expect(parts().button?.getAttribute('aria-label')).toBe('Turn off preview')

    badge.show({ status: 'off' })
    parts().button?.click()

    expect(setEnabled).toHaveBeenLastCalledWith(true)
    expect(parts().button?.getAttribute('aria-label')).toBe('Turn on preview')

    badge.hide()

    expect(parts().host).toBeNull()

    badge.show({ status: 'ready' })

    expect(parts().host).not.toBeNull()
  })

  it('stays closed until the page reloads once its close button was clicked', () => {
    const setEnabled = vi.fn()
    const badge = createBadge(setEnabled)

    badge.show({ status: 'ready' })
    parts().close?.click()

    expect(parts().host).toBeNull()
    expect(setEnabled).not.toHaveBeenCalled()

    badge.show({ status: 'off' })
    badge.hide()
    badge.show({ status: 'ready' })

    expect(parts().host).toBeNull()
  })

  it('hides itself on the page that shows the editor', () => {
    createBadge(() => {}).show({ status: 'ready' })

    expect(document.head.textContent).toContain('body:has([data-forgepress-editor]) > forgepress-preview { display: none !important; }')
  })
})
