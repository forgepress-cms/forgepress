import type { ComputedRef, Ref } from 'vue'
import type { ChangeService, ChangeSummary, FileDiff, Resolution } from '../../src/changes/types'
import type { Conflict } from '../../src/forge/types'
import type { FileIssues } from '../utils/issues'
import { computed, ref, shallowRef } from 'vue'
import { checkResult } from '../../src/forge/check'
import { commitMessage, ConflictError, InvalidContentError, publishFiles } from '../../src/forge/publish'
import { errorMessage } from '../../src/utils/error'
import { fileIssues } from '../utils/issues'
import { useBuild } from './useBuild'
import { useContent } from './useContent'
import { useSession } from './useSession'

export interface Publisher {
  summary: Ref<ChangeSummary>
  diff: Ref<FileDiff[]>
  count: ComputedRef<number>
  publishing: Ref<boolean>
  error: Ref<string>
  conflicts: Ref<readonly Conflict[]>
  issues: Ref<readonly FileIssues[]>
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
const issues = shallowRef<readonly FileIssues[]>([])
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
  const build = useBuild()

  async function refresh(): Promise<void> {
    issues.value = []

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

  async function stop(commit: string): Promise<void> {
    await content.pin(commit)
    await refresh()
  }

  return {
    summary,
    diff,
    count,
    publishing,
    error,
    conflicts,
    issues,
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

      const target = await content.target()

      publishing.value = true
      error.value = ''
      issues.value = []

      try {
        const files = await changes.files(target)

        if (files.length === 0) {
          error.value = 'There is nothing to publish.'

          return undefined
        }

        const message = commitMessage(session.provider.value?.commitMessage, name)
        const commit = await publishFiles(forge, files, message, target, listing => checkResult(listing, files, content.read, target))

        conflicts.value = []

        await content.published(commit)
        await build.track(commit)
        await refresh()

        return commit
      }
      catch (cause) {
        const failed = (failure: unknown): void => {
          error.value = errorMessage(failure)
        }

        if (cause instanceof ConflictError) {
          conflicts.value = cause.conflicts
          await stop(cause.commit).catch(failed)
        }
        else if (cause instanceof InvalidContentError) {
          await stop(cause.commit).catch(failed)
          issues.value = fileIssues(cause.issues, target)
        }
        else {
          failed(cause)
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
