import type { ComputedRef, Ref } from 'vue'
import { computed, ref, shallowRef } from 'vue'
import { commitMessage, toFiles } from '../../content/forge'
import { bakedFormat, bakedMedia } from '../../content/source'
import { useContent } from './useContent'
import { useSession } from './useSession'

export interface PublishSummary {
  published?: string
  schema: boolean
  written: string[]
  removed: string[]
  uploads: string[]
  deleted: string[]
}

export interface Publisher {
  summary: Ref<PublishSummary>
  count: ComputedRef<number>
  publishing: Ref<boolean>
  error: Ref<string>
  refresh: () => Promise<void>
  publish: (name: string) => Promise<string | undefined>
}

function empty(): PublishSummary {
  return { schema: false, written: [], removed: [], uploads: [], deleted: [] }
}

const summary = shallowRef<PublishSummary>(empty())
const publishing = ref(false)
const error = ref('')

const count = computed(() => {
  const current = summary.value

  return current.written.length + current.removed.length
    + current.uploads.length + current.deleted.length
    + (current.schema ? 1 : 0)
})

export function usePublish(): Publisher {
  const content = useContent()
  const session = useSession()

  async function refresh(): Promise<void> {
    const draft = await content.draft()

    if (!draft) {
      summary.value = empty()

      return
    }

    const [changes, media] = await Promise.all([draft.changes.pending(), draft.uploads.pending()])

    summary.value = {
      ...changes.published === undefined ? {} : { published: changes.published },
      schema: changes.schema,
      written: changes.written,
      removed: changes.removed,
      uploads: Object.keys(media.uploads),
      deleted: media.removed,
    }
  }

  return {
    summary,
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
        const [changes, media, format, baked] = await Promise.all([
          draft.changes.snapshot(),
          draft.uploads.pending(),
          bakedFormat(),
          bakedMedia(),
        ])

        const files = toFiles(changes, media, {
          mediaDir: baked.dir,
          base: session.provider.value?.base,
          format: format ?? undefined,
        })

        if (files.length === 0) {
          error.value = 'There is nothing to publish.'

          return undefined
        }

        const commit = await forge.commit(files, commitMessage(session.provider.value?.commitMessage, name))

        await draft.changes.published(commit)
        await draft.uploads.published(commit)
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
