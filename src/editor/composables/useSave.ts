import type { Ref } from 'vue'
import { ref } from 'vue'

export interface Save {
  saving: Ref<boolean>
  error: Ref<string>
  save: (write: () => Promise<void>) => Promise<boolean>
}

export function useSave(): Save {
  const saving = ref(false)
  const error = ref('')

  async function save(write: () => Promise<void>): Promise<boolean> {
    saving.value = true
    error.value = ''

    try {
      await write()
      return true
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { saving, error, save }
}
