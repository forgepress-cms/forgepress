import type { Ref } from 'vue'
import type { ContentRow } from '../../types/entry'
import type { EntryValues } from '../utils/entry'
import type { FormField } from '../utils/schema'
import type { Draft } from './useDraft'
import { reactive, ref } from 'vue'
import { toRow, toValues } from '../utils/entry'
import { useDraft } from './useDraft'
import { useLeaveGuard } from './useLeaveGuard'

export interface EntryDraft extends Draft {
  values: EntryValues
  status: Ref<ContentRow['status']>
  draft: () => ContentRow
}

export function useEntryDraft(
  row: ContentRow,
  fields: FormField[],
  locales: readonly string[],
  leave: () => void,
  related?: (next: ContentRow) => unknown,
): EntryDraft {
  const values = reactive(toValues(fields, row, locales))
  const status = ref(row.status)

  function draft(): ContentRow {
    return toRow(fields, values, { ...row, status: status.value })
  }

  function snapshot(): unknown {
    const next = draft()

    return related ? [next, related(next)] : next
  }

  return { values, status, draft, ...useLeaveGuard(useDraft(snapshot, leave)) }
}
