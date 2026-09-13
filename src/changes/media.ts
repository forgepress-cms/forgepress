import type { BakedMedia, MediaClient, PendingUpload } from '../media/types'
import type { Mutate, Ready } from './content'
import type { Previews } from './previews'
import { mediaType, toAssetName } from '../media'

async function digest(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)

  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

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

      return [...uploaded, ...existing].sort((left, right) =>
        right.modifiedAt.localeCompare(left.modifiedAt) || left.name.localeCompare(right.name))
    },

    upload: async (file) => {
      const { url, maxSize } = await baked()
      const type = mediaType(file.name)

      if (!type)
        throw new Error(`[forgepress] "${file.name}" is not a supported media file`)

      const data = await file.arrayBuffer()

      if (data.byteLength > maxSize)
        throw new Error(`[forgepress] "${file.name}" is larger than the ${Math.round(maxSize / 1024 / 1024)} MB upload limit`)

      const upload: PendingUpload = {
        name: toAssetName(file.name, await digest(data)),
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
