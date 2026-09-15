import type { MediaAsset, MediaStore } from '../media/types'
import type { MediaConfig } from '../types/config'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assetUrl, checkUpload, isAssetName, isMediaFile, mediaType, resolveMedia, sortAssets, toAssetName } from '../media'

export function createMediaStore(root: string, config?: MediaConfig): MediaStore {
  const media = resolveMedia(config)
  const dir = join(root, media.dir)

  async function describe(name: string): Promise<MediaAsset> {
    const info = await stat(join(dir, name))

    return {
      name,
      url: assetUrl(media.url, name),
      type: mediaType(name),
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
    }
  }

  return {
    async list() {
      if (!existsSync(dir))
        return []

      const files = (await readdir(dir)).filter(isMediaFile)

      return sortAssets(await Promise.all(files.map(describe)))
    },

    async write({ name, data }) {
      checkUpload(name, data.byteLength, media.maxSize)

      const file = toAssetName(name, createHash('sha256').update(data).digest('hex'))

      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, file), data)

      return describe(file)
    },

    async remove(name) {
      if (!isAssetName(name))
        throw new Error(`[forgepress] "${name}" is not a valid asset name`)

      await rm(join(dir, name), { force: true })
    },
  }
}
