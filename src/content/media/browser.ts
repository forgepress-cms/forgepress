import type { BakedMedia, MediaAsset, MediaClient, PendingUpload, StoredMedia } from '../../types/content/media'
import type { KeyValueStore } from '../../types/content/store'
import { assetUrl, mediaType, toAssetName } from './index'

export interface MediaBuffer extends MediaClient {
  pending: () => Promise<StoredMedia>
  published: (commit: string) => Promise<void>
  discard: () => Promise<void>
}

function empty(): StoredMedia {
  return { uploads: {}, removed: [] }
}

async function digest(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)

  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function createMediaBuffer(baked: () => Promise<BakedMedia>, store: KeyValueStore<StoredMedia>): MediaBuffer {
  let loaded: Promise<StoredMedia> | undefined

  const previews = new Map<string, string>()

  function ready(): Promise<StoredMedia> {
    loaded ??= store.read().then(media => media ?? empty())

    return loaded
  }

  async function mutate(apply: (media: StoredMedia) => void): Promise<void> {
    const media = await ready()

    apply(media)

    delete media.published

    await store.write(media)
  }

  function preview(upload: PendingUpload): string {
    if (typeof URL.createObjectURL !== 'function')
      return ''

    let url = previews.get(upload.name)

    if (!url) {
      url = URL.createObjectURL(new Blob([upload.data], { type: upload.type }))
      previews.set(upload.name, url)
    }

    return url
  }

  function describe(upload: PendingUpload, prefix: string): MediaAsset {
    const local = preview(upload)

    return {
      name: upload.name,
      url: assetUrl(prefix, upload.name),
      type: upload.type,
      size: upload.size,
      modifiedAt: upload.modifiedAt,
      ...local ? { preview: local } : {},
    }
  }

  function forget(name: string): void {
    const url = previews.get(name)

    if (!url)
      return

    URL.revokeObjectURL(url)
    previews.delete(name)
  }

  return {
    list: async () => {
      const { url, assets } = await baked()
      const media = await ready()
      const removed = new Set(media.removed)

      const uploaded = Object.values(media.uploads).map(upload => describe(upload, url))
      const existing = assets.filter(asset => !removed.has(asset.name) && !(asset.name in media.uploads))

      return [...uploaded, ...existing].sort((left, right) =>
        right.modifiedAt.localeCompare(left.modifiedAt) || left.name.localeCompare(right.name))
    },

    upload: async (file) => {
      const { url, maxSize } = await baked()
      const type = mediaType(file.name)

      if (!type)
        throw new Error(`[webenv] "${file.name}" is not a supported media file`)

      const data = await file.arrayBuffer()

      if (data.byteLength > maxSize)
        throw new Error(`[webenv] "${file.name}" is larger than the ${Math.round(maxSize / 1024 / 1024)} MB upload limit`)

      const upload: PendingUpload = {
        name: toAssetName(file.name, await digest(data)),
        type,
        size: data.byteLength,
        modifiedAt: new Date().toISOString(),
        data,
      }

      await mutate((media) => {
        media.uploads[upload.name] = upload
        media.removed = media.removed.filter(name => name !== upload.name)
      })

      return describe(upload, url)
    },

    remove: async (name) => {
      await mutate((media) => {
        if (media.uploads[name])
          delete media.uploads[name]
        else if (!media.removed.includes(name))
          media.removed.push(name)
      })

      forget(name)
    },

    pending: ready,

    published: async (commit) => {
      const media = await ready()

      media.published = commit

      await store.write(media)
    },

    discard: async () => {
      for (const name of [...previews.keys()])
        forget(name)

      loaded = Promise.resolve(empty())

      await store.clear()
    },
  }
}
