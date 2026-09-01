import type { Ref } from 'vue'
import { computed, ref } from 'vue'

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

  const highlighted = computed(() => {
    if (!dragging.value || to.value === from.value)
      return -1

    const others = total.value - 1

    if (to.value >= others)
      return total.value - 1

    return to.value < from.value ? to.value : to.value + 1
  })

  function start(key: string, index: number, event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement
    const container = handle.closest('[data-drag]')
    const rows = [...container?.querySelectorAll<HTMLElement>(':scope > *') ?? []]
    const others = rows.filter((_, position) => position !== index).map(row => row.getBoundingClientRect())

    if (!others.length)
      return

    dragging.value = key
    from.value = index
    to.value = index
    total.value = rows.length

    handle.setPointerCapture(event.pointerId)

    function onMove(pointer: PointerEvent): void {
      const above = others.findIndex(rect => pointer.clientY < rect.top + rect.height / 2)

      to.value = above < 0 ? others.length : above
    }

    function onEnd(): void {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)

      const offset = to.value - from.value

      dragging.value = ''

      if (offset)
        move(key, offset)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
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
