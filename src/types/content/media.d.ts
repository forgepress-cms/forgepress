export interface MediaAsset {
  name: string
  url: string
  type: string
  size: number
  modifiedAt: string
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
