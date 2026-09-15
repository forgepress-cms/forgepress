// @vitest-environment happy-dom
import type { EditorRouter } from '../../../src/editor/plugins/router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRouter } from '../../../src/editor/plugins/router'

const routes = { '': { name: 'index' }, 'content': { name: 'content' }, 'schema': { name: 'schema' } }

let router: EditorRouter

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function address(): string {
  return `${window.location.pathname}${window.location.search}`
}

async function traverse(search: string): Promise<void> {
  window.history.pushState(null, '', `/admin${search}`)
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
  await settle()
}

function click(href: string, init: MouseEventInit = {}, target = ''): boolean {
  const link = document.createElement('a')
  let followed = false

  const record = (event: Event): void => {
    followed = event.defaultPrevented
    event.preventDefault()
  }

  link.href = href
  link.target = target
  document.body.append(link)
  document.body.addEventListener('click', router.follow)
  window.addEventListener('click', record)
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0, ...init }))
  window.removeEventListener('click', record)
  document.body.removeEventListener('click', router.follow)
  link.remove()

  return followed
}

beforeEach(() => {
  window.history.replaceState(null, '', '/admin')
  router = createRouter(routes)
})

afterEach(() => {
  router.dispose()
})

describe('navigation', () => {
  it('starts on the page in the address once a framework has finished rewriting it', async () => {
    router.dispose()
    window.history.replaceState(null, '', '/admin?path=/content')
    window.history.replaceState(null, '', '/admin')
    router = createRouter(routes)
    window.history.replaceState(null, '', '/admin?path=/content')

    expect(router.route.value.path).toBe('')

    await settle()

    expect(router.route.value.path).toBe('content')
  })

  it('follows the browser back and forward', async () => {
    await traverse('?path=/content')

    expect(router.route.value.path).toBe('content')

    await traverse('')

    expect(router.route.value.path).toBe('')
  })

  it('follows a navigate call and keeps the page in the query, not the hash', () => {
    router.navigate('content')

    expect(router.route.value.path).toBe('content')
    expect(window.location.href).toBe(`${window.location.origin}/admin?path=/content`)

    router.navigate()

    expect(address()).toBe('/admin')
  })

  it('tells the router of the page about every change of the address', () => {
    const seen: string[] = []
    const listener = (): number => seen.push(address())

    window.addEventListener('popstate', listener)
    router.navigate('schema')
    window.removeEventListener('popstate', listener)

    expect(seen).toEqual(['/admin?path=/schema'])
    expect(router.route.value.path).toBe('schema')
  })

  it('links to editor pages on the same page', () => {
    expect(router.href('content/blogPost/post_1')).toBe('/admin?path=/content/blogPost/post_1')
    expect(router.href('content/a b')).toBe('/admin?path=/content/a%20b')
    expect(router.href()).toBe('/admin')
  })

  it('follows clicks on its own links and leaves every other link to the browser', () => {
    expect(click(router.href('content'))).toBe(true)
    expect(router.route.value.path).toBe('content')
    expect(address()).toBe('/admin?path=/content')

    const others: [href: string, init?: MouseEventInit, target?: string][] = [
      [router.href('schema'), { metaKey: true }],
      [router.href('schema'), { ctrlKey: true }],
      [router.href('schema'), {}, '_blank'],
      ['/admin?path=/schema&tab=fields'],
      ['/admin#schema'],
      ['/elsewhere?path=/schema'],
      ['https://example.com/admin?path=/schema'],
    ]

    for (const [href, init, target] of others)
      expect(click(href, init, target)).toBe(false)

    expect(router.route.value.path).toBe('content')
  })
})

describe('guards', () => {
  it('lets navigation through while nothing blocks', async () => {
    router.block(() => false)

    await traverse('?path=/content')

    expect(router.route.value.path).toBe('content')
  })

  it('holds a step back or forward and restores the address', async () => {
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    await traverse('?path=/schema')

    expect(router.route.value.path).toBe('')
    expect(address()).toBe('/admin')
    expect(resume).toBeTypeOf('function')
  })

  it('reaches the page that was held once resumed', async () => {
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    await traverse('?path=/schema')

    resume!()

    expect(router.route.value.path).toBe('schema')
    expect(address()).toBe('/admin?path=/schema')
  })

  it('holds a navigate call as well', () => {
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    router.navigate('content')

    expect(router.route.value.path).toBe('')
    expect(address()).toBe('/admin')

    resume!()

    expect(router.route.value.path).toBe('content')
    expect(address()).toBe('/admin?path=/content')
  })

  it('keeps guarding after a held navigation is resumed', async () => {
    let asked = 0

    router.block((proceed) => {
      asked += 1

      if (asked === 1)
        setTimeout(proceed)

      return true
    })

    await traverse('?path=/schema')
    await settle()

    expect(router.route.value.path).toBe('schema')

    await traverse('?path=/content')

    expect(asked).toBe(2)
    expect(router.route.value.path).toBe('schema')
  })

  it('stops guarding once released', async () => {
    const release = router.block(() => true)

    await traverse('?path=/schema')

    expect(router.route.value.path).toBe('')

    release()

    await traverse('?path=/schema')

    expect(router.route.value.path).toBe('schema')
  })
})

describe('reload', () => {
  it('opens the current page again', async () => {
    await traverse('?path=/content')

    const before = router.route.value

    router.reload()

    expect(router.route.value).not.toBe(before)
    expect(router.route.value.path).toBe('content')
  })

  it('asks the guards first and reloads once resumed', async () => {
    await traverse('?path=/content')

    const before = router.route.value
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    router.reload()

    expect(router.route.value).toBe(before)

    resume?.()

    expect(router.route.value).not.toBe(before)
    expect(router.route.value.path).toBe('content')
  })

  it('keeps guarding after a held reload is resumed', async () => {
    let asked = 0

    await traverse('?path=/content')

    router.block((proceed) => {
      asked += 1

      if (asked === 1)
        proceed()

      return true
    })

    router.reload()
    await traverse('?path=/schema')

    expect(asked).toBe(2)
    expect(router.route.value.path).toBe('content')
  })
})
