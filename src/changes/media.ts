import type { BakedMedia, MediaClient, PendingUpload } from '../media/types'
import type { Mutate, Ready } from './content'
import type { Previews } from './previews'
import { checkUpload, sortAssets, toAssetName } from '../media'
import { digest } from '../utils/encoding'

export function createMediaChanges(
  baked: () => Promise<BakedMedia>,
  previews: Previews,
  ready: Ready,
  mutate: Mutate,
): MediaClient {
  return {
    list: async () => {
      const { url, assets } = await baked()
      const changes = await ready()
      const deployed = new Set(assets.map(asset => asset.name))
      const published = Object.entries(changes.publishedMedia ?? {})
      const removed = new Set([...changes.removed, ...published.filter(([, upload]) => upload === null).map(([name]) => name)])

      const waiting = published.flatMap(([name, upload]) => upload && !deployed.has(name) && !removed.has(name) && !(name in changes.uploads) ? [upload] : [])
      const uploaded = [...Object.values(changes.uploads), ...waiting].map(upload => previews.asset(upload, url))
      const shown = new Set(uploaded.map(asset => asset.name))
      const existing = assets.filter(item => !removed.has(item.name) && !shown.has(item.name))

      return sortAssets([...uploaded, ...existing])
    },

    upload: async (file) => {
      const { url, maxSize } = await baked()
      const data = await file.arrayBuffer()
      const type = checkUpload(file.name, data.byteLength, maxSize)

      const upload: PendingUpload = {
        name: toAssetName(file.name, await digest('SHA-256', data)),
        type,
        size: data.byteLength,
        modifiedAt: new Date().toISOString(),
        data,
      }

      await mutate((changes) => {
        changes.uploads[upload.name] = upload
        changes.removed = changes.removed.filter(name => name !== upload.name)
      })

      return previews.asset(upload, url)
    },

    remove: async (name) => {
      await mutate((changes) => {
        if (changes.uploads[name])
          delete changes.uploads[name]
        else if (!changes.removed.includes(name))
          changes.removed.push(name)
      })

      previews.forget(name)
    },
  }
}
