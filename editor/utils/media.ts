import type { MediaKind } from '../../src/media'
import type { MediaAsset, MediaContent } from '../../src/media/types'
import { asList, isRecord } from '../../src/utils/value'

export interface Size {
  width: number
  height: number
}

const UNITS = ['B', 'KB', 'MB', 'GB']

export function formatSize(bytes: number): string {
  const exponent = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent

  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[exponent]}`
}

export function fileName(url: string): string {
  return url.split(/[?#]/)[0]!.split('/').pop() || url
}

export function measure(url: string, kind: MediaKind): Promise<Size | undefined> {
  return new Promise((resolve) => {
    if (kind === 'video') {
      const video = document.createElement('video')

      video.preload = 'metadata'
      video.addEventListener('loadedmetadata', () => resolve({ width: video.videoWidth, height: video.videoHeight }))
      video.addEventListener('error', () => resolve(undefined))
      video.src = url

      return
    }

    const image = new Image()

    image.addEventListener('load', () => resolve({ width: image.naturalWidth, height: image.naturalHeight }))
    image.addEventListener('error', () => resolve(undefined))
    image.src = url
  })
}

export async function toMedia(asset: MediaAsset, kind: MediaKind): Promise<MediaContent> {
  const size = await measure(asset.preview ?? asset.url, kind)

  return { url: asset.url, ...size }
}

export function toList(value: unknown): MediaContent[] {
  return asList(value).filter((item): item is MediaContent => isRecord(item))
}
