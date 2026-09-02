import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'

export interface Draft {
  dirty: ComputedRef<boolean>
  leaving: Ref<boolean>
  commit: () => void
  cancel: () => void
  discard: () => void
  proceed: () => void
}

export function useDraft(snapshot: () => unknown, leave: () => void): Draft {
  const saved = ref(JSON.stringify(snapshot()))
  const leaving = ref(false)

  const dirty = computed(() => JSON.stringify(snapshot()) !== saved.value)

  return {
    dirty,
    leaving,

    commit: () => {
      saved.value = JSON.stringify(snapshot())
    },

    cancel: () => {
      if (dirty.value)
        leaving.value = true
      else
        leave()
    },

    discard: leave,
    proceed: leave,
  }
}
