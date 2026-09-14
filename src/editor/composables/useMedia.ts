import type { Ref } from 'vue'
import type { MediaAsset } from '../../media/types'
import { ref, shallowRef } from 'vue'
import { errorMessage } from '../../utils/error'
import { fileName } from '../utils/media'
import { useContent } from './useContent'

export interface MediaLibrary {
  assets: Ref<MediaAsset[]>
  pending: Ref<boolean>
  error: Ref<string>
  ensure: () => Promise<void>
  refresh: () => Promise<void>
  upload: (files: File[]) => Promise<MediaAsset[]>
  remove: (name: string) => Promise<void>
  resolve: (url: string) => string
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
    error.value = errorMessage(cause)

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
  const { media } = useContent()

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

    resolve: (url) => {
      const name = fileName(url)

      return assets.value.find(asset => asset.name === name)?.preview ?? url
    },
  }
}
