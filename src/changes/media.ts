import type { MediaClient, MediaSource, PendingUpload } from '../media/types'
import type { Mutate, Ready } from './content'
import type { Previews } from './previews'
import type { Changes } from './types'
import { assetName, assetUrl, checkUpload, sortAssets, storedAsset } from '../media'

function publishedUploads(changes: Changes): PendingUpload[] {
  return Object.values(changes.publishedMedia ?? {}).filter(Boolean)
}

export function localUploads(changes: Changes): PendingUpload[] {
  const removed = new Set(changes.removed)
  const uploads = new Map([...Object.values(changes.uploads), ...publishedUploads(changes)].map(upload => [upload.name, upload]))

  return [...uploads.values()].filter(upload => !removed.has(upload.name))
}

export function createMediaChanges(media: MediaSource, previews: Previews, ready: Ready, mutate: Mutate): MediaClient {
  async function forgetServed(url: string): Promise<void> {
    const changes = await ready()
    const checked = await Promise.all(publishedUploads(changes).map(async upload => await media.served(assetUrl(url, upload.name)) ? [upload.name] : []))
    const served = checked.flat()

    if (served.length === 0)
      return

    await mutate((next) => {
      for (const name of served)
        delete next.publishedMedia?.[name]

      if (next.publishedMedia && Object.keys(next.publishedMedia).length === 0)
        delete next.publishedMedia
    })

    for (const name of served)
      previews.forget(name)
  }

  return {
    list: async () => {
      const { url } = await media.settings()

      await forgetServed(url)

      const [changes, stored] = await Promise.all([ready(), media.stored()])
      const removed = new Set(changes.removed)
      const local = localUploads(changes).map(upload => previews.asset(upload, url))
      const shown = new Set(local.map(asset => asset.name))
      const rest = stored.filter(name => !removed.has(name) && !shown.has(name)).map(name => storedAsset(name, url))

      return sortAssets([...local, ...rest])
    },

    upload: async (file) => {
      const { url, maxSize } = await media.settings()
      const data = await file.arrayBuffer()
      const type = checkUpload(file.name, data.byteLength, maxSize)
      const name = await assetName(file.name, data)

      if ((await media.stored()).includes(name)) {
        if ((await ready()).removed.includes(name)) {
          await mutate((changes) => {
            changes.removed = changes.removed.filter(item => item !== name)
          })
        }

        const published = (await ready()).publishedMedia?.[name]

        return published ? previews.asset(published, url) : storedAsset(name, url)
      }

      const upload: PendingUpload = {
        name,
        type,
        size: data.byteLength,
        modifiedAt: new Date().toISOString(),
        data,
      }

      await mutate((changes) => {
        changes.uploads[upload.name] = upload
        changes.removed = changes.removed.filter(item => item !== upload.name)
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
