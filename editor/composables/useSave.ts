import type { Ref } from 'vue'
import { ref } from 'vue'
import { errorMessage } from '../../src/utils/error'

export interface Save {
  saving: Ref<boolean>
  error: Ref<string>
  save: (write: () => Promise<void>) => Promise<boolean>
}

export async function attempt<TResult>(busy: Ref<boolean>, error: Ref<string>, action: () => Promise<TResult>, fallback: TResult): Promise<TResult> {
  busy.value = true
  error.value = ''

  try {
    return await action()
  }
  catch (cause) {
    error.value = errorMessage(cause)

    return fallback
  }
  finally {
    busy.value = false
  }
}

export function useSave(): Save {
  const saving = ref(false)
  const error = ref('')

  return {
    saving,
    error,

    save: write => attempt(saving, error, async () => {
      await write()

      return true
    }, false),
  }
}
