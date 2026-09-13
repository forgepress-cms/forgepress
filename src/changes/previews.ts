import type { MediaAsset, PendingUpload } from '../media/types'
import { assetUrl } from '../media'

export interface Previews {
  asset: (upload: PendingUpload, prefix: string) => MediaAsset
  forget: (name: string) => void
  clear: () => void
}

export function createPreviews(): Previews {
  const urls = new Map<string, string>()

  function preview(upload: PendingUpload): string {
    if (typeof URL.createObjectURL !== 'function')
      return ''

    let url = urls.get(upload.name)

    if (!url) {
      url = URL.createObjectURL(new Blob([upload.data], { type: upload.type }))
      urls.set(upload.name, url)
    }

    return url
  }

  function forget(name: string): void {
    const url = urls.get(name)

    if (!url)
      return

    URL.revokeObjectURL(url)
    urls.delete(name)
  }

  return {
    forget,

    asset: (upload, prefix) => {
      const local = preview(upload)

      return {
        name: upload.name,
        url: assetUrl(prefix, upload.name),
        type: upload.type,
        size: upload.size,
        modifiedAt: upload.modifiedAt,
        ...local ? { preview: local } : {},
      }
    },

    clear: () => {
      for (const name of [...urls.keys()])
        forget(name)
    },
  }
}
