import type { ComputedRef, Ref } from 'vue'
import type { ChangeService, ChangeSummary, FileDiff, Resolution } from '../../changes/types'
import type { Conflict } from '../../forge/types'
import { computed, ref, shallowRef } from 'vue'
import { commitMessage, ConflictError, publishFiles } from '../../forge/publish'
import { errorMessage } from '../../utils/error'
import { useContent } from './useContent'
import { useSession } from './useSession'

export interface Publisher {
  summary: Ref<ChangeSummary>
  diff: Ref<FileDiff[]>
  count: ComputedRef<number>
  publishing: Ref<boolean>
  error: Ref<string>
  conflicts: Ref<readonly Conflict[]>
  refresh: () => Promise<void>
  publish: (name: string) => Promise<string | undefined>
  resolve: (keep: Resolution) => Promise<boolean>
}

function empty(): ChangeSummary {
  return { written: [], discarded: [], uploaded: [], deleted: [] }
}

const summary = shallowRef<ChangeSummary>(empty())
const diff = shallowRef<FileDiff[]>([])
const publishing = ref(false)
const error = ref('')
const conflicts = shallowRef<readonly Conflict[]>([])
const followed = new WeakSet<ChangeService>()

const count = computed(() => {
  const current = summary.value

  return current.written.length + current.discarded.length + current.uploaded.length + current.deleted.length
})

function follow(changes: ChangeService): void {
  if (followed.has(changes))
    return

  followed.add(changes)

  changes.subscribe(() => {
    changes.summary().then((next) => {
      summary.value = next
    }, () => undefined)
  })
}

export function usePublish(): Publisher {
  const content = useContent()
  const session = useSession()

  async function refresh(): Promise<void> {
    const changes = await content.changes()

    if (!changes) {
      summary.value = empty()
      diff.value = []

      return
    }

    follow(changes)

    summary.value = await changes.summary()
    diff.value = await changes.diff(await content.target())
  }

  async function stop(cause: ConflictError): Promise<void> {
    conflicts.value = cause.conflicts

    await content.pin(cause.commit)
    await refresh()
  }

  return {
    summary,
    diff,
    count,
    publishing,
    error,
    conflicts,
    refresh,

    publish: async (name) => {
      const changes = await content.changes()

      if (!changes) {
        error.value = 'Publishing is only available in a deployed editor.'

        return undefined
      }

      const forge = session.forge()

      if (!forge) {
        error.value = 'Sign in before publishing.'

        return undefined
      }

      publishing.value = true
      error.value = ''

      try {
        const target = await content.target()
        const files = await changes.files(target)

        if (files.length === 0) {
          error.value = 'There is nothing to publish.'

          return undefined
        }

        const commit = await publishFiles(forge, files, commitMessage(session.provider.value?.commitMessage, name), target)

        conflicts.value = []

        await content.published(commit)
        await refresh()

        return commit
      }
      catch (cause) {
        if (cause instanceof ConflictError) {
          await stop(cause).catch((failure: unknown) => {
            error.value = errorMessage(failure)
          })
        }
        else {
          error.value = errorMessage(cause)
        }

        return undefined
      }
      finally {
        publishing.value = false
      }
    },

    resolve: async (keep) => {
      const changes = await content.changes()

      if (!changes)
        return false

      error.value = ''

      try {
        await changes.resolve(conflicts.value, await content.target(), keep)

        conflicts.value = []

        await refresh()

        return true
      }
      catch (cause) {
        error.value = errorMessage(cause)

        return false
      }
    },
  }
}
