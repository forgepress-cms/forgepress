import type { Ref } from 'vue'
import type { ContentRow } from '../../types/content/reader'
import type { EntryValues } from '../utils/entry'
import type { Field } from '../utils/schema'
import type { Draft } from './useDraft'
import { reactive, ref } from 'vue'
import { fromValues, toValues } from '../utils/entry'
import { useDraft } from './useDraft'
import { useLeaveGuard } from './useLeaveGuard'

export interface EntryDraft extends Draft {
  values: EntryValues
  status: Ref<ContentRow['status']>
  draft: () => ContentRow
}

export function useEntryDraft(
  row: ContentRow,
  fields: Field[],
  locales: readonly string[],
  leave: () => void,
): EntryDraft {
  const values = reactive(toValues(fields, row, locales))
  const status = ref(row.status)

  function draft(): ContentRow {
    const next: ContentRow = { ...row, status: status.value }

    for (const field of fields) {
      const value = fromValues(field, values)

      if (value === undefined)
        delete next[field.key]
      else
        next[field.key] = value
    }

    return next
  }

  return { values, status, draft, ...useLeaveGuard(useDraft(draft, leave)) }
}
