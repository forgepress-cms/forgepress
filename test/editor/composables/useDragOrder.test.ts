// @vitest-environment happy-dom
import type { DragOrder } from '../../../editor/composables/useDragOrder'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useDragOrder } from '../../../editor/composables/useDragOrder'

const ROW = 40

let scope: ReturnType<typeof effectScope> | undefined

function list(keys: string[]): { order: DragOrder, moves: [string, number][], handles: HTMLElement[] } {
  const moves: [string, number][] = []
  const container = document.createElement('div')

  container.dataset.drag = ''

  const handles = keys.map((_, index) => {
    const row = document.createElement('div')
    const handle = document.createElement('button')

    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 0, y: index * ROW, width: 200, height: ROW }))
    handle.setPointerCapture = () => {}
    row.append(handle)
    container.append(row)

    return handle
  })

  document.body.append(container)
  scope = effectScope()

  return { order: scope.run(() => useDragOrder((key, offset) => moves.push([key, offset])))!, moves, handles }
}

function pointer(type: string, clientY = 0): MouseEvent {
  return new MouseEvent(type, { clientY })
}

async function grab(order: DragOrder, handle: HTMLElement, key: string, index: number): Promise<void> {
  order.start(key, index, { currentTarget: handle, pointerId: 1 } as unknown as PointerEvent)
  await nextTick()
}

afterEach(() => {
  scope?.stop()
  scope = undefined
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('useDragOrder', () => {
  it('moves the dragged row to where it is dropped and marks the rows meanwhile', async () => {
    const { order, moves, handles } = list(['a', 'b', 'c'])

    await grab(order, handles[0]!, 'a', 0)
    handles[0]!.dispatchEvent(pointer('pointermove', 3 * ROW))

    expect(order.dragging.value).toBe('a')
    expect(order.rowClass(0, 'a')).toBe('opacity-40')
    expect(order.rowClass(2, 'c')).toBe('bg-primary/10')

    handles[0]!.dispatchEvent(pointer('pointerup'))

    expect(moves).toEqual([['a', 2]])
    expect(order.dragging.value).toBe('')
  })

  it('leaves the order alone when a row is dropped where it was', async () => {
    const { order, moves, handles } = list(['a', 'b', 'c'])

    await grab(order, handles[1]!, 'b', 1)
    handles[1]!.dispatchEvent(pointer('pointermove', ROW + 1))
    handles[1]!.dispatchEvent(pointer('pointercancel'))

    expect(moves).toEqual([])
  })

  it('stops following the pointer once the drag ended', async () => {
    const { order, moves, handles } = list(['a', 'b', 'c'])

    await grab(order, handles[2]!, 'c', 2)
    handles[2]!.dispatchEvent(pointer('pointermove', 0))
    handles[2]!.dispatchEvent(pointer('pointerup'))
    await nextTick()
    handles[2]!.dispatchEvent(pointer('pointermove', 3 * ROW))
    handles[2]!.dispatchEvent(pointer('pointerup'))

    expect(moves).toEqual([['c', -2]])
  })
})
