export interface MediaAsset {
  name: string
  url: string
  type: string
  size: number
  modifiedAt: string
  preview?: string
}

export interface PendingUpload {
  name: string
  type: string
  size: number
  modifiedAt: string
  data: ArrayBuffer
}

export interface StoredMedia {
  uploads: Record<string, PendingUpload>
  removed: string[]
}

export interface BakedMedia {
  url: string
  maxSize: number
  assets: MediaAsset[]
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
