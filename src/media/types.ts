export interface MediaContent {
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface MediaAsset {
  name: string
  url: string
  type: string
  size?: number
  modifiedAt?: string
  preview?: string
}

export interface PendingUpload {
  name: string
  type: string
  size: number
  modifiedAt: string
  data: ArrayBuffer
}

export interface MediaSettings {
  dir: string
  url: string
  maxSize: number
}

export interface MediaSource {
  settings: () => Promise<MediaSettings>
  stored: () => Promise<string[]>
  served: (url: string) => Promise<boolean>
}

export interface MediaUpload {
  name: string
  data: Uint8Array
}

export interface MediaStore {
  list: () => Promise<MediaAsset[]>
  write: (upload: MediaUpload) => Promise<MediaAsset>
  remove: (name: string) => Promise<void>
}

export interface MediaClient {
  list: () => Promise<MediaAsset[]>
  upload: (file: File) => Promise<MediaAsset>
  remove: (name: string) => Promise<void>
}
