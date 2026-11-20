import type { Ref } from 'vue'
import type { Entry } from '../../../src/entries'
import type { EntryValues, FormField } from '../../utils'
import type { Draft } from '../common/useDraft'
import { reactive, ref } from 'vue'
import { toRow, toValues } from '../../utils'
import { useDraft } from '../common/useDraft'
import { useLeaveGuard } from '../common/useLeaveGuard'

export interface EntryDraft extends Draft {
  values: EntryValues
  status: Ref<Entry['status']>
  draft: () => Entry
}

export function useEntryDraft(
  row: Entry,
  fields: FormField[],
  locales: readonly string[],
  leave: () => void,
  related?: (next: Entry) => unknown,
): EntryDraft {
  const values = reactive(toValues(fields, row, locales))
  const status = ref(row.status)

  function draft(): Entry {
    return toRow(fields, values, { ...row, status: status.value })
  }

  function snapshot(): unknown {
    const next = draft()

    return related ? [next, related(next)] : next
  }

  return { values, status, draft, ...useLeaveGuard(useDraft(snapshot, leave)) }
}
