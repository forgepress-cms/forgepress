import type { Ref } from 'vue'
import { ref } from 'vue'
import { onPreviewChange, previewEnabled, setPreviewEnabled } from '../../src/preview/state'

export interface PreviewSwitch {
  enabled: Ref<boolean>
  set: (enabled: boolean) => void
}

const enabled = ref(previewEnabled())

let following = false

export function usePreview(): PreviewSwitch {
  if (!following) {
    following = true

    onPreviewChange(() => {
      enabled.value = previewEnabled()
    })
  }

  return { enabled, set: setPreviewEnabled }
}
