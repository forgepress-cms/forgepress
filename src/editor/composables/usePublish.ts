import type { ComputedRef, Ref } from 'vue'
import type { ChangeSummary, FileDiff, Resolution } from '../../changes/types'
import type { Conflict, RepoTarget } from '../../forge/types'
import { computed, ref, shallowRef } from 'vue'
import { commitMessage, toFiles } from '../../forge'
import { ConflictError, publishFiles } from '../../forge/publish'
import { baked } from '../../store/bundle'
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
  return { schema: false, written: [], discarded: [], dropped: [], uploaded: [], deleted: [] }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

const summary = shallowRef<ChangeSummary>(empty())
const diff = shallowRef<FileDiff[]>([])
const publishing = ref(false)
const error = ref('')
const conflicts = shallowRef<readonly Conflict[]>([])

const count = computed(() => {
  const current = summary.value

  return current.written.length + current.discarded.length + current.dropped.length
    + current.uploaded.length + current.deleted.length
    + (current.schema ? 1 : 0)
})

export function usePublish(): Publisher {
  const content = useContent()
  const session = useSession()

  async function target(): Promise<RepoTarget> {
    const settings = await baked()

    return {
      paths: settings.paths,
      mediaDir: settings.media.dir,
      base: session.provider.value?.base,
      format: settings.format,
    }
  }

  async function refresh(): Promise<void> {
    const changes = await content.changes()

    if (!changes) {
      summary.value = empty()
      diff.value = []

      return
    }

    summary.value = await changes.summary()
    diff.value = await changes.diff(await target())
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
        const repo = await target()
        const files = toFiles(await changes.snapshot(), repo)

        if (files.length === 0) {
          error.value = 'There is nothing to publish.'

          return undefined
        }

        const commit = await publishFiles(forge, files, commitMessage(session.provider.value?.commitMessage, name), repo)

        conflicts.value = []

        await content.published(commit)
        await refresh()

        return commit
      }
      catch (cause) {
        if (cause instanceof ConflictError) {
          await stop(cause).catch((failure: unknown) => {
            error.value = message(failure)
          })
        }
        else {
          error.value = message(cause)
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
        await changes.resolve(conflicts.value, await target(), keep)

        conflicts.value = []

        await refresh()

        return true
      }
      catch (cause) {
        error.value = message(cause)

        return false
      }
    },
  }
}
