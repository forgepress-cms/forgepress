import type { Draft } from './useDraft'
import { useEventListener } from '@vueuse/core'
import { onScopeDispose, watch } from 'vue'
import { useRouter } from './useRouter'

export function useLeaveGuard(draft: Draft): Draft {
  const { block } = useRouter()

  let resume: (() => void) | undefined
  let allowed = false

  const release = block((proceed) => {
    if (allowed || !draft.dirty.value)
      return false

    resume = proceed
    draft.leaving.value = true

    return true
  })

  useEventListener(window, 'beforeunload', (event) => {
    if (!allowed && draft.dirty.value)
      event.preventDefault()
  })

  watch(draft.leaving, (asking) => {
    if (!asking)
      resume = undefined
  })

  onScopeDispose(release)

  function go(): void {
    const pending = resume

    allowed = true
    resume = undefined
    draft.leaving.value = false

    if (pending)
      pending()
    else
      draft.proceed()
  }

  return { ...draft, discard: go, proceed: go }
}
