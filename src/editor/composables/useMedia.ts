import type { Ref } from 'vue'
import type { MediaAsset } from '../../types/content/media'
import { ref, shallowRef } from 'vue'
import { media } from '../media'

export interface MediaLibrary {
  assets: Ref<MediaAsset[]>
  pending: Ref<boolean>
  error: Ref<string>
  ensure: () => Promise<void>
  refresh: () => Promise<void>
  upload: (files: File[]) => Promise<MediaAsset[]>
  remove: (name: string) => Promise<void>
}

const assets = shallowRef<MediaAsset[]>([])
const pending = ref(false)
const error = ref('')

let loaded = false

async function run<TResult>(action: () => Promise<TResult>, fallback: TResult): Promise<TResult> {
  pending.value = true
  error.value = ''

  try {
    return await action()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)

    return fallback
  }
  finally {
    pending.value = false
  }
}

function merge(added: MediaAsset[]): void {
  const names = new Set(added.map(asset => asset.name))

  assets.value = [...added, ...assets.value.filter(asset => !names.has(asset.name))]
}

export function useMedia(): MediaLibrary {
  async function refresh(): Promise<void> {
    assets.value = await run(() => media.list(), assets.value)
    loaded = true
  }

  return {
    assets,
    pending,
    error,

    refresh,

    ensure: async () => {
      if (!loaded)
        await refresh()
    },

    upload: async (files) => {
      const uploaded = await run(async () => {
        const results: MediaAsset[] = []

        for (const file of files)
          results.push(await media.upload(file))

        return results
      }, [])

      merge(uploaded)

      return uploaded
    },

    remove: async (name) => {
      await run(() => media.remove(name), undefined)

      assets.value = assets.value.filter(asset => asset.name !== name)
    },
  }
}
