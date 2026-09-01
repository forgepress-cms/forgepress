import type { MediaConfig } from '../../types/config/media'

export type MediaKind = 'image' | 'video'

export const MEDIA_TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  ogv: 'video/ogg',
  webm: 'video/webm',
}

export const MEDIA_DEFAULTS = {
  dir: 'public/uploads',
  url: '/uploads',
  maxSize: 8 * 1024 * 1024,
} as const satisfies Required<MediaConfig>

export type ResolvedMedia = Required<MediaConfig>

const EXTENSION = /\.([a-z0-9]+)$/i
const SEPARATOR = /[^a-z0-9]+/gi
const TRIM = /^-+|-+$/g
const NAME = /^[a-z0-9][\w.-]*$/i

export function resolveMedia(config?: MediaConfig): ResolvedMedia {
  return { ...MEDIA_DEFAULTS, ...config }
}

export function extension(file: string): string {
  return EXTENSION.exec(file)?.[1]?.toLowerCase() ?? ''
}

export function mediaType(file: string): string {
  return MEDIA_TYPES[extension(file)] ?? ''
}

export function mediaKind(file: string): MediaKind | undefined {
  const type = mediaType(file)

  return type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : undefined
}

export function mediaAccept(kind?: MediaKind): string {
  return Object.keys(MEDIA_TYPES)
    .filter(name => !kind || mediaKind(`.${name}`) === kind)
    .map(name => `.${name}`)
    .join(',')
}

export function slugify(value: string): string {
  return value.replace(SEPARATOR, '-').replace(TRIM, '').toLowerCase().slice(0, 48) || 'file'
}

export function toAssetName(file: string, hash: string): string {
  const found = EXTENSION.exec(file)
  const stem = found ? file.slice(0, -found[0].length) : file

  return `${slugify(stem)}.${hash.slice(0, 8)}${found ? `.${found[1]!.toLowerCase()}` : ''}`
}

export function isAssetName(name: string): boolean {
  return NAME.test(name) && !name.includes('..')
}

export function assetUrl(prefix: string, name: string): string {
  return `${prefix.replace(/\/+$/, '')}/${name}`
}
