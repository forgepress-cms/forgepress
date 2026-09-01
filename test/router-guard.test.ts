// @vitest-environment happy-dom
import type { EditorRouter } from '../src/editor/plugins/router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRouter } from '../src/editor/plugins/router'

const routes = { '': { name: 'index' }, 'content': { name: 'content' }, 'schema': { name: 'schema' } }

let router: EditorRouter

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function follow(path: string): Promise<void> {
  window.location.hash = `#/${path}`
  await settle()
}

beforeEach(() => {
  window.location.hash = ''
  router = createRouter(routes)
})

afterEach(() => {
  router.dispose()
})

describe('navigation', () => {
  it('follows a link', async () => {
    await follow('content')

    expect(router.route.value.path).toBe('content')
  })

  it('follows a navigate call', async () => {
    router.navigate('content')
    await settle()

    expect(router.route.value.path).toBe('content')
  })
})

describe('guards', () => {
  it('lets navigation through while nothing blocks', async () => {
    router.block(() => false)

    await follow('content')

    expect(router.route.value.path).toBe('content')
  })

  it('holds a link click and restores the hash', async () => {
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    await follow('schema')

    expect(router.route.value.path).toBe('')
    expect(window.location.hash).toBe('#/')
    expect(resume).toBeTypeOf('function')
  })

  it('reaches the link that was held once resumed', async () => {
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    await follow('schema')

    resume!()
    await settle()

    expect(router.route.value.path).toBe('schema')
  })

  it('holds a navigate call as well', async () => {
    let resume: (() => void) | undefined

    router.block((proceed) => {
      resume = proceed

      return true
    })

    router.navigate('content')
    await settle()

    expect(router.route.value.path).toBe('')

    resume!()
    await settle()

    expect(router.route.value.path).toBe('content')
  })

  it('keeps guarding after a held navigation is resumed', async () => {
    let asked = 0

    router.block((proceed) => {
      asked += 1

      if (asked === 1)
        setTimeout(proceed)

      return true
    })

    await follow('schema')
    await settle()

    expect(router.route.value.path).toBe('schema')

    await follow('content')

    expect(asked).toBe(2)
    expect(router.route.value.path).toBe('schema')
  })

  it('stops guarding once released', async () => {
    const release = router.block(() => true)

    await follow('schema')

    expect(router.route.value.path).toBe('')

    release()

    await follow('schema')

    expect(router.route.value.path).toBe('schema')
  })
})
