import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

export interface DragOrder {
  dragging: Ref<string>
  rowClass: (index: number, key: string) => string
  start: (key: string, index: number, event: PointerEvent) => void
}

export function useDragOrder(move: (key: string, offset: number) => unknown): DragOrder {
  const dragging = ref('')
  const from = ref(0)
  const to = ref(0)
  const total = ref(0)
  const handle = shallowRef<HTMLElement>()

  let others: DOMRect[] = []

  const highlighted = computed(() => {
    if (!dragging.value || to.value === from.value)
      return -1

    const last = total.value - 1

    if (to.value >= last)
      return total.value - 1

    return to.value < from.value ? to.value : to.value + 1
  })

  useEventListener(handle, 'pointermove', (pointer) => {
    const above = others.findIndex(rect => pointer.clientY < rect.top + rect.height / 2)

    to.value = above < 0 ? others.length : above
  })

  useEventListener(handle, ['pointerup', 'pointercancel'], () => {
    const key = dragging.value
    const offset = to.value - from.value

    handle.value = undefined
    dragging.value = ''

    if (offset)
      move(key, offset)
  })

  function start(key: string, index: number, event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement
    const container = target.closest('[data-drag]')
    const rows = [...container?.querySelectorAll<HTMLElement>(':scope > *') ?? []]

    others = rows.filter((_, position) => position !== index).map(row => row.getBoundingClientRect())

    if (!others.length)
      return

    dragging.value = key
    from.value = index
    to.value = index
    total.value = rows.length

    target.setPointerCapture(event.pointerId)
    handle.value = target
  }

  function rowClass(index: number, key: string): string {
    if (!dragging.value)
      return ''

    if (key === dragging.value)
      return 'opacity-40'

    return index === highlighted.value ? 'bg-primary/10' : ''
  }

  return { dragging, rowClass, start }
}
