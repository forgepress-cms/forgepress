import type { ComputedRef, Ref } from 'vue'
import type { PublishTarget } from '../../content/forge'
import type { DraftSummary, FileDiff } from '../../types/content/draft'
import { computed, ref, shallowRef } from 'vue'
import { commitMessage, toFiles } from '../../content/forge'
import { bakedFormat, bakedMedia } from '../../content/source'
import { useContent } from './useContent'
import { useSession } from './useSession'

export interface Publisher {
  summary: Ref<DraftSummary>
  diff: Ref<FileDiff[]>
  count: ComputedRef<number>
  publishing: Ref<boolean>
  error: Ref<string>
  refresh: () => Promise<void>
  publish: (name: string) => Promise<string | undefined>
}

function empty(): DraftSummary {
  return { schema: false, written: [], dropped: [], uploaded: [], deleted: [] }
}

const summary = shallowRef<DraftSummary>(empty())
const diff = shallowRef<FileDiff[]>([])
const publishing = ref(false)
const error = ref('')

const count = computed(() => {
  const current = summary.value

  return current.written.length + current.dropped.length
    + current.uploaded.length + current.deleted.length
    + (current.schema ? 1 : 0)
})

export function usePublish(): Publisher {
  const content = useContent()
  const session = useSession()

  async function target(): Promise<PublishTarget> {
    const [format, baked] = await Promise.all([bakedFormat(), bakedMedia()])

    return {
      mediaDir: baked.dir,
      base: session.provider.value?.base,
      format: format ?? undefined,
    }
  }

  async function refresh(): Promise<void> {
    const draft = await content.draft()

    if (!draft) {
      summary.value = empty()
      diff.value = []

      return
    }

    summary.value = await draft.summary()
    diff.value = await draft.diff(await target())
  }

  return {
    summary,
    diff,
    count,
    publishing,
    error,
    refresh,

    publish: async (name) => {
      const draft = await content.draft()

      if (!draft) {
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
        const files = toFiles(await draft.snapshot(), await target())

        if (files.length === 0) {
          error.value = 'There is nothing to publish.'

          return undefined
        }

        const commit = await forge.commit(files, commitMessage(session.provider.value?.commitMessage, name))

        await draft.published(commit)
        await refresh()

        return commit
      }
      catch (cause) {
        error.value = cause instanceof Error ? cause.message : String(cause)

        return undefined
      }
      finally {
        publishing.value = false
      }
    },
  }
}
