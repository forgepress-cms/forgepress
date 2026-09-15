import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeSocket extends EventTarget {
  static opened: FakeSocket[] = []

  readonly url: string

  constructor(url: string) {
    super()
    this.url = url
    FakeSocket.opened.push(this)
  }

  emit(type: string, data?: string): void {
    this.dispatchEvent(Object.assign(new Event(type), { data }))
  }
}

const reload = vi.fn()

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  FakeSocket.opened = []
  reload.mockClear()
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('location', { reload })
  vi.stubGlobal('__FORGEPRESS_SETTINGS__', JSON.stringify({ local: true, devServer: 'http://127.0.0.1:4321' }))

  await import('../../src/next/reload')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('next dev reload', () => {
  it('reloads the page when the dev server says the content changed', () => {
    const [socket] = FakeSocket.opened

    expect(socket?.url).toBe('ws://127.0.0.1:4321/__forgepress/events')

    socket?.emit('open')
    socket?.emit('message', 'something else')
    expect(reload).not.toHaveBeenCalled()

    socket?.emit('message', 'reload')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('connects again after the dev server restarts, waiting longer while it stays away', () => {
    FakeSocket.opened[0]?.emit('open')
    FakeSocket.opened[0]?.emit('close')

    vi.advanceTimersByTime(1000)
    expect(FakeSocket.opened).toHaveLength(2)

    FakeSocket.opened[1]?.emit('close')
    vi.advanceTimersByTime(1999)
    expect(FakeSocket.opened).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.opened).toHaveLength(3)

    FakeSocket.opened[2]?.emit('close')
    vi.advanceTimersByTime(4000)
    expect(FakeSocket.opened).toHaveLength(4)
  })
})
