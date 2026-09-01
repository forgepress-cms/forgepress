import type { MediaKind } from '../../content/media'
import type { ImageContent } from '../../elements/image'
import type { MediaAsset } from '../../types/content/media'

export type MediaValue = ImageContent

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

export async function toMedia(asset: MediaAsset, kind: MediaKind): Promise<MediaValue> {
  const size = await measure(asset.url, kind)

  return { url: asset.url, ...size }
}

export function toList(value: unknown): MediaValue[] {
  if (Array.isArray(value))
    return value.filter(item => item && typeof item === 'object') as MediaValue[]

  return value && typeof value === 'object' ? [value as MediaValue] : []
}
