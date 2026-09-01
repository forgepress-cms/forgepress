import type { Draft } from './useDraft'
import { onScopeDispose, watch } from 'vue'
import { useRouter } from './useRouter'

export function useLeaveGuard(draft: Draft): Draft {
  const { block } = useRouter()

  let resume: (() => void) | undefined
  let leaving = false

  const release = block((proceed) => {
    if (leaving || !draft.dirty.value)
      return false

    resume = proceed
    draft.leaving.value = true

    return true
  })

  function onUnload(event: BeforeUnloadEvent): void {
    if (!leaving && draft.dirty.value)
      event.preventDefault()
  }

  window.addEventListener('beforeunload', onUnload)

  watch(draft.leaving, (asking) => {
    if (!asking)
      resume = undefined
  })

  onScopeDispose(() => {
    release()
    window.removeEventListener('beforeunload', onUnload)
  })

  return {
    ...draft,

    discard: () => {
      const pending = resume

      leaving = true
      resume = undefined
      draft.leaving.value = false

      if (pending)
        pending()
      else
        draft.discard()
    },
  }
}
